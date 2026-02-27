"""Lessons router — CRUD for fleet_lessons."""

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from src.db import async_session

router = APIRouter(prefix="/lessons", tags=["lessons"])


class LessonOut(BaseModel):
    id: int
    agentId: int
    agentName: str
    archetype: str
    category: str
    lesson: str
    context: str | None
    isActive: bool
    createdAt: datetime


class DeactivateOut(BaseModel):
    status: str


@router.get("", response_model=list[LessonOut])
async def list_lessons():
    """Return all active fleet lessons, newest first."""
    query = text("""
        SELECT fl.id, fl.agent_id, a.display_name AS agent_name, fl.archetype,
               fl.category, fl.lesson, fl.context, fl.is_active, fl.created_at
        FROM fleet_lessons fl
        JOIN agents a ON a.id = fl.agent_id
        WHERE fl.is_active = true
        ORDER BY fl.created_at DESC
    """)
    async with async_session() as session:
        result = await session.execute(query)
        rows = result.mappings().all()

    return [
        LessonOut(
            id=row["id"],
            agentId=row["agent_id"],
            agentName=row["agent_name"],
            archetype=row["archetype"],
            category=row["category"],
            lesson=row["lesson"],
            context=row["context"],
            isActive=row["is_active"],
            createdAt=row["created_at"],
        )
        for row in rows
    ]


@router.post("/{lesson_id}/deactivate", response_model=DeactivateOut)
async def deactivate_lesson(lesson_id: int):
    """Soft-delete a lesson by setting is_active = false."""
    query = text("UPDATE fleet_lessons SET is_active = false WHERE id = :id")
    async with async_session() as session:
        result = await session.execute(query, {"id": lesson_id})
        await session.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return DeactivateOut(status="deactivated")
