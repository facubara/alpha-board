import Image from "next/image";
import Link from "next/link";

export function LogoSwitcher() {
  return (
    <Link href="/" aria-label="Home">
      <Image
        src="/logos/ascii-logo.png"
        alt="Alpha Board"
        width={76}
        height={38}
        className="h-[38px] w-auto rounded-sm"
        priority
      />
    </Link>
  );
}
