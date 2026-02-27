"""
Triage Twitter following list into 3 buckets: analyst, memecoin, discard.
Reads following.js from project root, outputs 3 JSON files.

Auth modes (picks first available):
  1. TWITTER_AUTH_TOKEN + TWITTER_CT0 env vars → uses Twitter GraphQL (no credit limit)
  2. TWITTER_BEARER_TOKEN env var → uses Twitter API v2 (credit-limited)

Supports resuming: caches API responses in triage_cache.json so if
rate-limited, re-run and it picks up where it left off.
"""

import json
import os
import re
import time

import httpx

FOLLOWING_JS_PATH = os.path.join(os.path.dirname(__file__), "..", "following.js")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..")
CACHE_PATH = os.path.join(OUTPUT_DIR, "triage_cache.json")

MEMECOIN_KEYWORDS = [
    "memecoin", "meme coin", "degen", "ape", "pump", "moon", "shitcoin",
    "100x", "1000x", "gem", "call group", "alpha calls", "nfa",
    "solana degen", "sol degen", "ct degen", "rug", "airdrop hunter",
]

MEMECOIN_PATTERN = re.compile(
    "|".join(re.escape(kw) for kw in MEMECOIN_KEYWORDS),
    re.IGNORECASE,
)


def parse_following_js(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    json_str = raw.replace("window.YTD.following.part0 = ", "", 1)
    data = json.loads(json_str)
    return [entry["following"]["accountId"] for entry in data]


def load_cache() -> dict[str, dict | None]:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache: dict[str, dict | None]):
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)


# ── GraphQL lookup (cookie-based, no credit limit) ──────────────────────

GRAPHQL_USER_BY_ID = "https://x.com/i/api/graphql/xc8f1g7BYqr6VTzTbvNLGw/UserByRestId"
GRAPHQL_FEATURES = {
    "hidden_profile_subscriptions_enabled": True,
    "rweb_tipjar_consumption_enabled": True,
    "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False,
    "highlights_tweets_tab_ui_enabled": True,
    "responsive_web_twitter_article_notes_tab_enabled": True,
    "subscriptions_feature_can_gift_premium": True,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "responsive_web_graphql_timeline_navigation_enabled": True,
}


def graphql_headers(auth_token: str, ct0: str) -> dict:
    return {
        "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
        "Cookie": f"auth_token={auth_token}; ct0={ct0}",
        "X-Csrf-Token": ct0,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "X-Twitter-Active-User": "yes",
        "X-Twitter-Auth-Type": "OAuth2Session",
    }


def graphql_parse_user(data: dict) -> dict | None:
    """Parse GraphQL UserByRestId response into a normalized user dict."""
    try:
        result = data["data"]["user"]["result"]
        if result.get("__typename") == "UserUnavailable":
            return None
        legacy = result.get("legacy", {})
        return {
            "id": result["rest_id"],
            "username": legacy.get("screen_name", ""),
            "name": legacy.get("name", ""),
            "description": legacy.get("description", ""),
            "public_metrics": {
                "followers_count": legacy.get("followers_count", 0),
                "following_count": legacy.get("friends_count", 0),
                "tweet_count": legacy.get("statuses_count", 0),
            },
        }
    except (KeyError, TypeError):
        return None


def lookup_users_graphql(ids: list[str], auth_token: str, ct0: str) -> list[dict]:
    """Lookup users one-by-one via Twitter GraphQL (cookie auth)."""
    cache = load_cache()
    cached_ids = set(cache.keys())
    remaining_ids = [id_ for id_ in ids if id_ not in cached_ids]

    if cached_ids:
        print(f"  Cache: {len(cached_ids)} users already fetched, {len(remaining_ids)} remaining")

    if not remaining_ids:
        print("  All users already cached, skipping API calls")
        return [u for u in cache.values() if u is not None]

    headers = graphql_headers(auth_token, ct0)
    features_str = json.dumps(GRAPHQL_FEATURES)

    for i, user_id in enumerate(remaining_ids):
        params = {
            "variables": json.dumps({"userId": user_id, "withSafetyModeUserFields": True}),
            "features": features_str,
        }

        try:
            resp = httpx.get(GRAPHQL_USER_BY_ID, headers=headers, params=params, timeout=15)

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "60"))
                print(f"\n  Rate limited at user {i+1}/{len(remaining_ids)}. Waiting {retry_after}s...")
                time.sleep(retry_after)
                # Retry this one
                resp = httpx.get(GRAPHQL_USER_BY_ID, headers=headers, params=params, timeout=15)

            if resp.status_code == 403:
                print(f"\n  Auth expired (403). Saving cache with {len(cache)} users.")
                save_cache(cache)
                break

            if resp.status_code != 200:
                print(f"  [{user_id}] HTTP {resp.status_code}, skipping")
                cache[user_id] = None
                continue

            user = graphql_parse_user(resp.json())
            cache[user_id] = user

            if user:
                handle = user["username"]
            else:
                handle = "unavailable"

            if (i + 1) % 50 == 0 or i == 0:
                print(f"  {i+1}/{len(remaining_ids)}: @{handle}")
                save_cache(cache)

        except Exception as e:
            print(f"  [{user_id}] Error: {e}")
            cache[user_id] = None

        # Delay to avoid rate limiting (GraphQL has ~500 req/15min)
        time.sleep(1.2)

    save_cache(cache)
    return [u for u in cache.values() if u is not None]


# ── API v2 lookup (bearer token, credit-limited) ────────────────────────

def lookup_users_v2(ids: list[str], bearer_token: str) -> list[dict]:
    """Batch lookup users via Twitter API v2, 100 at a time."""
    cache = load_cache()
    cached_ids = set(cache.keys())
    remaining_ids = [id_ for id_ in ids if id_ not in cached_ids]

    if cached_ids:
        print(f"  Cache: {len(cached_ids)} users already fetched, {len(remaining_ids)} remaining")

    if not remaining_ids:
        print("  All users already cached, skipping API calls")
        return [u for u in cache.values() if u is not None]

    url = "https://api.twitter.com/2/users"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    params_base = {"user.fields": "name,username,description,public_metrics"}

    errors = []
    total_batches = (len(remaining_ids) + 99) // 100

    for i in range(0, len(remaining_ids), 100):
        batch = remaining_ids[i : i + 100]
        params = {**params_base, "ids": ",".join(batch)}

        resp = httpx.get(url, headers=headers, params=params, timeout=30)

        if resp.status_code in (402, 429):
            print(f"\n  Rate limited (HTTP {resp.status_code}). Saving cache ({len(cache)} users).")
            save_cache(cache)
            break

        resp.raise_for_status()
        body = resp.json()

        if "data" in body:
            for user in body["data"]:
                cache[user["id"]] = user
        if "errors" in body:
            errors.extend(body["errors"])
            for err in body.get("errors", []):
                if "value" in err:
                    cache[err["value"]] = None

        batch_num = i // 100 + 1
        print(f"  Batch {batch_num}/{total_batches}: got {len(body.get('data', []))} users, {len(body.get('errors', []))} errors")
        save_cache(cache)

        if i + 100 < len(remaining_ids):
            time.sleep(1)

    if errors:
        print(f"\n  {len(errors)} accounts not found (suspended/deleted)")

    return [u for u in cache.values() if u is not None]


# ── Classification ───────────────────────────────────────────────────────

def classify(user: dict) -> tuple[str, str]:
    followers = user.get("public_metrics", {}).get("followers_count", 0)
    if followers < 400:
        return "discard", f"followers_count={followers} (<400)"
    text = f"{user.get('name', '')} {user.get('description', '')}"
    match = MEMECOIN_PATTERN.search(text)
    if match:
        return "memecoin", f"matched keyword: '{match.group()}'"
    return "analyst", "default (no memecoin keywords, >=400 followers)"


def build_entry(user: dict, reason: str) -> dict:
    return {
        "id": user["id"],
        "handle": user.get("username", ""),
        "name": user.get("name", ""),
        "bio": user.get("description", ""),
        "followers_count": user.get("public_metrics", {}).get("followers_count", 0),
        "category_reason": reason,
    }


def write_output(filename: str, entries: list[dict]):
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    print(f"  {filename}: {len(entries)} accounts")


def main():
    print("Parsing following.js...")
    account_ids = parse_following_js(FOLLOWING_JS_PATH)
    print(f"  Found {len(account_ids)} account IDs\n")

    # Pick auth mode
    auth_token = os.environ.get("TWITTER_AUTH_TOKEN")
    ct0 = os.environ.get("TWITTER_CT0")
    bearer_token = os.environ.get("TWITTER_BEARER_TOKEN")

    if auth_token and ct0:
        print("Using GraphQL mode (cookie auth, no credit limit)\n")
        print("Looking up users via Twitter GraphQL...")
        users = lookup_users_graphql(account_ids, auth_token, ct0)
    elif bearer_token:
        print("Using API v2 mode (bearer token, credit-limited)\n")
        print("Looking up users via Twitter API v2...")
        users = lookup_users_v2(account_ids, bearer_token)
    else:
        print("ERROR: No auth configured.")
        print("  Set TWITTER_AUTH_TOKEN + TWITTER_CT0 (preferred)")
        print("  Or set TWITTER_BEARER_TOKEN")
        return

    print(f"\n  Total users resolved: {len(users)}\n")

    print("Classifying accounts...")
    buckets: dict[str, list[dict]] = {"analyst": [], "memecoin": [], "discard": []}

    for user in users:
        bucket, reason = classify(user)
        entry = build_entry(user, reason)
        buckets[bucket].append(entry)

    print("\nWriting output files...")
    write_output("triage_analyst.json", buckets["analyst"])
    write_output("triage_memecoin.json", buckets["memecoin"])
    write_output("triage_discard.json", buckets["discard"])

    total = sum(len(v) for v in buckets.values())
    unfetched = len(account_ids) - total
    print(f"\nSummary:")
    print(f"  Analyst:  {len(buckets['analyst'])}")
    print(f"  Memecoin: {len(buckets['memecoin'])}")
    print(f"  Discard:  {len(buckets['discard'])}")
    print(f"  Total classified: {total}")
    if unfetched > 0:
        print(f"  Not yet fetched:  {unfetched} (re-run script to resume)")


if __name__ == "__main__":
    main()
