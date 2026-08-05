#!/usr/bin/env python3
"""Curate GLEAS-level reading passages (L1 elementary-first)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "reading-passages" / "passages-by-level.json"


def wc(text: str) -> int:
    return len(text.split())


def pas(
    pid: str,
    level: int,
    cefr: str,
    target_b: float,
    source: str,
    title: str,
    text: str,
    order: int,
) -> dict:
    text = " ".join(text.split())
    return {
        "id": pid,
        "level": level,
        "cefr": cefr,
        "wordCount": wc(text),
        "targetB": target_b,
        "source": source,
        "title": title,
        "text": text,
        "suggestedQuestionTypes": ["main_idea", "detail", "inference", "purpose"],
        "order": order,
    }


L1 = [
    pas(
        "preset-L1-P01",
        1,
        "A1",
        -2.2,
        "academy-curated/elementary",
        "My Pet Dog",
        """
        I have a small dog. His name is Max. Max is brown and white.
        Every morning, I give Max food and water. After school, I walk with Max in the park.
        Max likes to run and play with a ball. On rainy days, we stay home.
        Max sleeps next to my bed. I love my dog very much.
        """,
        1,
    ),
    pas(
        "preset-L1-P02",
        1,
        "A1",
        -2.1,
        "academy-curated/elementary",
        "A School Day",
        """
        Mina goes to school at eight o'clock. She has English, math, and art.
        At lunch, she eats rice and soup with her friends.
        After lunch, they play soccer outside. Mina likes art class the most.
        She draws animals and flowers. At three o'clock, she goes home.
        She does her homework and helps her mother.
        """,
        2,
    ),
    pas(
        "preset-L1-P03",
        1,
        "A1",
        -2.0,
        "academy-curated/elementary",
        "Weekend Picnic",
        """
        On Saturday, our family goes to the park for a picnic.
        Father carries a big basket. Mother makes sandwiches and fruit.
        My sister and I bring a ball and a kite.
        We eat under a big tree. Then we fly the kite high in the sky.
        It is a happy day. We want to come again next weekend.
        """,
        3,
    ),
    pas(
        "preset-L1-P04",
        1,
        "A1-A2",
        -1.9,
        "academy-curated/elementary",
        "My Best Friend",
        """
        Tom is my best friend. We are in the same class.
        Tom is kind and funny. He always helps me with English words.
        After school, we ride our bikes together. Sometimes we read comic books.
        Tom does not like rainy days because we cannot play outside.
        I am happy to have a good friend like Tom.
        """,
        4,
    ),
    pas(
        "preset-L1-P05",
        1,
        "A1-A2",
        -1.85,
        "academy-curated/elementary",
        "At the Library",
        """
        Our class visits the library every Friday. The library is quiet and clean.
        I look for animal books on the big shelf. The librarian smiles and helps me.
        I can borrow two books for one week. At home, I read before bed.
        Books teach me new things. I want to read more next week.
        """,
        5,
    ),
]

L2_SOFT = {
    "preset-L2-P03": pas(
        "preset-L2-P03",
        2,
        "A2",
        -0.95,
        "academy-curated/middle",
        "Club Fair Day",
        """
        Last Friday, our school held a club fair in the gym. Many tables showed different clubs:
        science, music, cooking, and soccer. I talked with the science club teacher.
        She said they make small robots. My friend joined the music club because she likes to sing.
        I chose the cooking club. We will learn how to make simple healthy snacks.
        The fair helped students find interesting activities after school.
        """,
        3,
    ),
    "preset-L2-P04": pas(
        "preset-L2-P04",
        2,
        "A2",
        -0.9,
        "academy-curated/middle",
        "A Letter About Late Homework",
        """
        Dear Mr. Kim, I am writing about my science homework. Yesterday I was sick and stayed home from school.
        I finished math and English, but I could not finish the science project.
        I feel better today and I can work on it this evening.
        May I submit the project tomorrow morning? Thank you for your understanding.
        Sincerely, Jisoo Park
        """,
        4,
    ),
}


def main() -> None:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    data["version"] = "1.1.0"
    data["description"] = (
        "Level-preset reading passages curated by GLEAS level. "
        "L1 = elementary-appropriate A1 texts; higher levels increase difficulty."
    )
    data["policy"] = {
        **(data.get("policy") or {}),
        "doNotRewritePassage": True,
        "generateItemsFromPassageOnly": True,
        "irtAlignBToLevelTheta": True,
        "gradeLocksDefaultLevel": True,
    }
    data["levels"]["1"] = {
        "level": 1,
        "passageCount": len(L1),
        "passages": L1,
    }
    l2 = data["levels"]["2"]["passages"]
    for i, p in enumerate(l2):
        if p["id"] in L2_SOFT:
            l2[i] = L2_SOFT[p["id"]]
    data["levels"]["2"]["passages"] = l2
    data["levels"]["2"]["passageCount"] = len(l2)

    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("L1 counts", [p["wordCount"] for p in L1])
    print("updated", PATH)


if __name__ == "__main__":
    main()
