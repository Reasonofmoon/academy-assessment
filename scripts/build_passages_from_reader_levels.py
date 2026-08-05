#!/usr/bin/env python3
"""
Build GLEAS level reading presets using *original* texts whose difficulty
is calibrated to CEFR bands, with local graded-reader series as references only.

IMPORTANT — copyright:
  Commercial series (Fly Guy, Nate the Great, Dragon Masters, etc.) must NOT be
  copied into this repo. This script only:
  1) indexes local file *names/paths* into source-catalog.json (no body text)
  2) groups those series by CEFR band (operator judgment)
  3) writes original academy passages for GLEAS L1–L6 / CEFR Pre-A1…B2

Usage:
  python scripts/build_passages_from_reader_levels.py
  python scripts/build_passages_from_reader_levels.py --source "C:/Users/sound/Downloads/..."
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT_PASSAGES = REPO / "data" / "reading-passages" / "passages-by-level.json"
OUT_CATALOG = REPO / "data" / "reading-passages" / "source-catalog.json"

# ---------------------------------------------------------------------------
# Local series → CEFR (primary) → GLEAS placement reference (secondary)
# Operator judgment: CEFR first; GLEAS is the app's placement ladder.
# ---------------------------------------------------------------------------
SERIES_META: dict[str, dict] = {
    "Little Critter": {
        "cefrPrimary": "Pre-A1",
        "cefrMin": "Pre-A1",
        "cefrMax": "Pre-A1",
        "cefrNote": "Below A1: very short sentences, high picture dependence, basic daily vocab.",
        "gleasLevelReference": 1,
        "gleasRole": "L1 lower (early elementary)",
    },
    "Fly Guy": {
        "cefrPrimary": "A1",
        "cefrMin": "Pre-A1",
        "cefrMax": "A1",
        "cefrNote": "A1 or below: short repeated structures, simple narrative.",
        "gleasLevelReference": 1,
        "gleasRole": "L1 core (elementary)",
    },
    "Dragon Masters": {
        "cefrPrimary": "A2",
        "cefrMin": "A1",
        "cefrMax": "A2",
        "cefrNote": "Chapter adventure; reaches solid A2, not B1.",
        "gleasLevelReference": 2,
        "gleasRole": "L2 A2 adventure reference",
    },
    "Horrid Henry": {
        "cefrPrimary": "A2",
        "cefrMin": "A2",
        "cefrMax": "A2",
        "cefrNote": "School/home humour; A2 range (not B1).",
        "gleasLevelReference": 2,
        "gleasRole": "L2 A2 school-story reference",
    },
    "Magic Treehouse Merlin Mission": {
        "cefrPrimary": "A2",
        "cefrMin": "A2",
        "cefrMax": "A2",
        "cefrNote": "Extended adventure chapters around A2.",
        "gleasLevelReference": 2,
        "gleasRole": "L2–L3 A2 extended narrative reference",
    },
    "Nate the Great": {
        "cefrPrimary": "A2-B1",
        "cefrMin": "A2",
        "cefrMax": "B1",
        "cefrNote": "Mystery chapter books; higher than pure A2, up to early B1. Calibrates L3 only.",
        "gleasLevelReference": 3,
        "gleasRole": "L3 A2–B1 bridge (not used for L4 pack)",
    },
    "My Weird School": {
        "cefrPrimary": "A2-B1",
        "cefrMin": "A2",
        "cefrMax": "B1",
        "cefrNote": "Funny school chapters; denser than early A2, up to B1 possible. Calibrates L3 only.",
        "gleasLevelReference": 3,
        "gleasRole": "L3 A2–B1 bridge (not used for L4 pack)",
    },
}

# CEFR band order for catalog grouping
CEFR_BAND_ORDER = ["Pre-A1", "A1", "A2", "A2-B1", "B1", "B1-B2", "B2"]

# GLEAS placement ladder (app) with CEFR labels + which local series calibrate difficulty
LEVEL_META = {
    1: {
        "cefr": "Pre-A1/A1",
        "cefrPrimary": "A1",
        "theta": -2.2,
        "grades": "초1–초6",
        "refSeries": ["Little Critter", "Fly Guy"],
        "ref": "CEFR Pre-A1–A1 (Little Critter / Fly Guy band)",
    },
    2: {
        "cefr": "A2",
        "cefrPrimary": "A2",
        "theta": -0.95,
        "grades": "중1–중2",
        "refSeries": ["Dragon Masters", "Horrid Henry", "Magic Treehouse Merlin Mission"],
        "ref": "CEFR A2 (Dragon Masters / Horrid Henry / Magic Tree House band)",
    },
    3: {
        "cefr": "A2-B1",
        "cefrPrimary": "A2-B1",
        "theta": 0.25,
        "grades": "중3–고1",
        "refSeries": ["Nate the Great", "My Weird School"],
        "ref": "CEFR A2–B1 bridge (Nate the Great / My Weird School)",
    },
    4: {
        "cefr": "B1",
        "cefrPrimary": "B1",
        "theta": 1.0,
        "grades": "고2–고3",
        "refSeries": [],
        "ref": "CEFR B1 (academy original only — no commercial series)",
    },
    5: {
        "cefr": "B1-B2",
        "cefrPrimary": "B1-B2",
        "theta": 1.7,
        "grades": "advanced",
        "refSeries": [],
        "ref": "CEFR B1–B2 (academy original only — no commercial series)",
    },
    6: {
        "cefr": "B2",
        "cefrPrimary": "B2",
        "theta": 2.4,
        "grades": "advanced+",
        "refSeries": [],
        "ref": "CEFR B2 (academy original only — dense / academic-adjacent)",
    },
}


def wc(text: str) -> int:
    return len(text.split())


def passage(
    level: int,
    order: int,
    title: str,
    text: str,
    qtypes: list[str] | None = None,
) -> dict:
    meta = LEVEL_META[level]
    clean = " ".join(text.split())
    return {
        "id": f"preset-L{level}-P{order:02d}",
        "level": level,
        "cefr": meta["cefr"],
        "wordCount": wc(clean),
        "targetB": round(meta["theta"] + (order - 3) * 0.05, 2),
        "source": f"academy-original/{meta['ref']}",
        "title": title,
        "text": clean,
        "suggestedQuestionTypes": qtypes
        or ["main_idea", "detail", "inference", "purpose"],
        "order": order,
    }


# ---------------------------------------------------------------------------
# ORIGINAL passages (not taken from commercial books)
# ---------------------------------------------------------------------------

PASSAGES: dict[int, list[dict]] = {
    1: [
        passage(
            1,
            1,
            "A Red Ball",
            """
            Sam has a small red ball. Every afternoon he kicks the ball in the yard.
            One day the ball rolls under a big tree. Sam looks left and right.
            He cannot see it at first. Then he looks behind the tree and smiles.
            He picks up the ball and kicks it again. His little sister claps her hands.
            Playing outside with the red ball makes Sam happy every day.
            """,
        ),
        passage(
            1,
            2,
            "Rainy Morning",
            """
            It is raining hard this morning. Mia cannot ride her bike outside.
            She sits by the window with a picture book. Her gray cat sits beside her.
            They listen to the soft sound of rain on the glass.
            Mia drinks warm milk and turns the pages slowly.
            Her mother brings a blanket, and Mia shares it with the cat.
            She likes quiet rainy days at home.
            """,
        ),
        passage(
            1,
            3,
            "Bus to School",
            """
            Every school day Jin waits for the yellow bus at the corner.
            The bus comes at seven o'clock. He sits with his friend Hana near the window.
            They talk about games, snacks, and their pet dogs.
            Sometimes they count red cars on the road.
            When the bus stops at school, they wave goodbye and run to class with their bags.
            Jin likes the bus ride because he starts the day with a friend.
            """,
        ),
        passage(
            1,
            4,
            "Grandma's Soup",
            """
            On cold evenings Grandma makes warm vegetable soup for dinner.
            The kitchen smells good. I help set the bowls and spoons on the table.
            Dad brings bread, and we all sit down together.
            We talk about school and the garden. After dinner I wash the bowls carefully.
            Grandma says thank you and smiles at me. Helping at home feels good.
            """,
        ),
        passage(
            1,
            5,
            "New Shoes",
            """
            Today I wear my new blue shoes for the first time. They feel soft and light.
            On the playground I run and jump with my friends.
            One friend says, "Nice shoes!" I feel proud and a little shy.
            We play tag until the bell rings. After school I clean the shoes
            and put them by the door for tomorrow. I want to keep them clean and bright.
            """,
        ),
    ],
    2: [
        passage(
            2,
            1,
            "The Missing Pencil Case",
            """
            After math class, Sora could not find her pencil case.
            She looked under her desk, inside her bag, and even in her coat pocket.
            Her friend Min said he saw a blue case near the art room door.
            They walked there together and checked each chair carefully.
            The case was on a chair under a drawing apron. Sora thanked Min
            and promised to help him next time he lost something.
            She also decided to put her name clearly on the case.
            """,
        ),
        passage(
            2,
            2,
            "Science Fair Plan",
            """
            Our class is preparing for the science fair next month.
            Joon wants to show how plants grow toward light.
            He will put two plants in boxes, one dark and one bright.
            Every day he will write notes, measure the stems, and take photos.
            His partner will make a poster with labels and a short explanation.
            Joon hopes the judges will like his careful work and clear data.
            If the plants grow differently, he will explain why light matters.
            """,
        ),
        passage(
            2,
            3,
            "Library Detective",
            """
            Someone left a note in the library: "Meet me by the big globe."
            Yuna likes small mysteries, so she went to the globe after school.
            She found another note under a map book. It said, "Look outside."
            Near the door she saw her little brother laughing with a red marker.
            He only wanted to play a game and leave a trail of clues.
            Yuna laughed too and helped him put the notes away before the librarian came.
            """,
        ),
        passage(
            2,
            4,
            "Soccer Tryouts",
            """
            Tae practiced soccer every evening for the school team tryouts.
            He was not the fastest runner, but he passed the ball well and listened to coaches.
            On tryout day he felt nervous, but his coach smiled and said, "Show your best pass."
            After the game, the coach said, "You help the team more than you know."
            Tae made the team and felt proud of his hard work.
            That night he told his parents the news and cleaned his muddy shoes.
            """,
        ),
        passage(
            2,
            5,
            "A Letter to My Teacher",
            """
            Dear Ms. Park, I am writing about yesterday's homework.
            I finished English and science, but I could not finish history.
            My little sister was sick, and I helped my mother take her to the clinic.
            We came home late, and I was too tired to write the full paragraph.
            May I bring the history homework tomorrow morning?
            Thank you for understanding. Sincerely, Hyejin.
            """,
        ),
    ],
    3: [
        passage(
            3,
            1,
            "The School Play Argument",
            """
            The class was choosing a play for the festival. Some students wanted a funny story.
            Others wanted a serious drama. Voices grew loud in the classroom.
            Ms. Lee raised her hand and asked everyone to write one reason on a sticky note.
            When they read the notes, they found a shared idea: a short comedy with a kind message.
            Two students who had argued offered to write the first scene together.
            The argument ended, and practice began the next week with clearer roles for everyone.
            """,
        ),
        passage(
            3,
            2,
            "Lost on the Field Trip",
            """
            During the museum field trip, Dae left his group to look at a robot exhibit.
            When he turned around, his class was gone. He felt his face grow hot.
            He remembered the rule: stay near a staff member if you are lost.
            A guard walked him to the meeting point by the main stairs.
            His teacher was relieved, and Dae promised to stay with the group.
            Later he wrote a short reflection about why museum rules protect students.
            """,
        ),
        passage(
            3,
            3,
            "Phone Rules at Home",
            """
            Our family made new phone rules last Sunday. No phones at dinner.
            No phones after ten o'clock on school nights. At first I was angry.
            I thought the rules were unfair because my friends stayed online later.
            After a week, I slept better and finished homework faster.
            Now I keep my phone in the living room after dinner and read for twenty minutes.
            The rules still feel strict, but they help me focus and talk more with my family.
            """,
        ),
        passage(
            3,
            4,
            "The Group Project",
            """
            Four students had to build a model bridge for history class.
            One member did almost nothing at first, and the others felt frustrated.
            They met after school and divided the work into clear tasks with deadlines.
            The quiet member agreed to paint and write labels after they asked calmly.
            On presentation day the bridge stood strong, and every name was on the poster.
            The teacher praised both the model and the way the team solved its conflict.
            """,
        ),
        passage(
            3,
            5,
            "A Rainy Championship",
            """
            The final basketball game started under heavy rain. The court was wet and slippery.
            Our team almost gave up in the first quarter. Then our captain said, "Play safe, pass more."
            We scored carefully and made fewer mistakes. In the last minute we won by two points.
            Wet uniforms never felt so good. Parents cheered under umbrellas by the fence.
            We learned that patience and teamwork can beat speed on a difficult day.
            """,
        ),
    ],
    4: [
        passage(
            4,
            1,
            "The Map in the Attic",
            """
            While cleaning the attic, Nari found a folded map inside a wooden box sealed with dusty tape.
            Red ink marked a trail from the old school to the river cave, with notes in a handwriting she almost recognized.
            Her brother insisted it was only a childhood game of their grandfather's, yet neither of them could ignore the careful detail.
            On Saturday they followed the trail with flashlights, water, and a charged phone in case the path disappeared.
            Near the cave entrance they discovered initials carved in stone—the same as their grandfather's—and a metal badge stamped 1958.
            The walk itself was short, but it connected them to a family story that had never been told at dinner.
            That night, when they finally asked, their grandfather smiled and began to speak as if he had waited decades for the question.
            """,
        ),
        passage(
            4,
            2,
            "Guarding the Bridge",
            """
            The village needed volunteers to watch the wooden bridge during storm season, when wind loosened boards without warning.
            Night travelers depended on that crossing, so a broken rail could turn an ordinary walk into a serious accident.
            Hoon signed up for the late shift even though he preferred mornings and disliked walking alone in heavy rain.
            Every hour he checked the boards with a lantern and recorded wind, water level, and any sound that seemed wrong.
            One night he found a broken rail and repaired it before dawn with spare rope and nails from the tool shed.
            Nobody celebrated loudly, but the mayor later sent a quiet letter thanking him for preventing harm no one saw.
            Hoon kept the letter in his toolkit as proof that careful work is often invisible until it fails.
            """,
        ),
        passage(
            4,
            3,
            "Signal from the Hill",
            """
            Every evening the lighthouse on the hill flashed three times so fishing boats could judge their distance from the rocks.
            One winter the light failed during thick fog, and sailors lost the only reliable mark along that stretch of coast.
            Engineers climbed the hill with tools and spare glass while cold air burned their faces and slowed every step.
            After hours of work the beam returned, cutting a white path through the fog and giving the boats a direction again.
            They turned safely toward the harbor, and the hill grew quiet once more.
            The town later installed a backup generator so a single equipment failure would not hide the entire coastline.
            The engineers argued that maintenance is less dramatic than rescue, yet it prevents the emergencies that fill newspapers.
            """,
        ),
        passage(
            4,
            4,
            "The Shared Notebook",
            """
            Two rival classes shared one science notebook for a year-long experiment on local birds and migration patterns.
            At first they filled the pages with sharp comments about missing dates, weak evidence, and each other's mistakes.
            Their teacher required every entry to include a measurement, a short explanation, and one polite question for the other class.
            Slowly the tone changed; students began answering with photographs, counts, and clearer hypotheses instead of insults.
            By spring the notebook held a continuous record that no single class could have produced alone.
            The final report listed both class names, and the rivalry felt smaller than the shared result.
            They learned that cooperation does not erase competition, but it can turn competition into better evidence.
            """,
        ),
        passage(
            4,
            5,
            "Escape from the Flooded Path",
            """
            After three days of rain, the mountain path became a stream that cut off the usual route to the parking lot.
            A group of hikers found themselves trapped between rising water and a steep wall of rock with no safe footholds.
            A ranger radioed for ropes and guided them along a higher ridge, insisting that speed mattered less than steady footing.
            No one was injured, yet everyone moved slowly and kept a hand on the person ahead when the wind rose.
            Later the ranger said, "Weather changes faster than plans," and asked them to review their forecasts before the next climb.
            The hikers donated spare gear to the ranger station and allowed the local paper to print their story as a warning, not a hero tale.
            The experience left them with a simple rule: respect the mountain's schedule more than your own.
            """,
        ),
    ],
    5: [
        passage(
            5,
            1,
            "Season of Dust Storms",
            """
            Traders usually crossed the desert only in the cooler months, but this year the storms arrived early and without the usual warning signs.
            Sand rose like walls and erased footprints within minutes, forcing the caravan to abandon landmarks they had trusted for years.
            Mira ordered a stop at a stone outpost and sealed every tent with heavy cloth so children and animals could breathe more easily.
            Inside, people counted the hours by the sound of wind rather than by sunlight, and arguments grew quieter as water supplies became the main concern.
            When the sky finally cleared, the dunes had shifted enough that the old trail no longer matched any map in the group.
            Using the stars and a small brass compass, they located the next well after two extra days of careful travel.
            Every person and camel arrived safely, and Mira recorded the new route so later groups would not depend on last year's path alone.
            """,
        ),
        passage(
            5,
            2,
            "The Hidden Garden Door",
            """
            Behind the museum library, Jack noticed a door half covered by ivy and almost flush with the brick wall.
            A faded sign read, "Staff only—plant records," yet the lock was loose and the air that escaped smelled of dry leaves rather than dust alone.
            Inside, shelves held pressed specimens, seed packets, and journals written by gardeners from a century earlier.
            One journal described a flower that bloomed only after rare night rain and warned that ordinary watering would never wake it.
            Jack reported the room to the curator, who admitted she had never been given a key or an inventory for that storage space.
            Together they found a living sample still surviving in a cracked pot by a narrow window, pale but not dead.
            The discovery became a quiet exhibit about patience and care, and visitors began leaving notes about plants their grandparents once grew.
            The room stayed open as a reminder that institutions sometimes forget the knowledge they were built to protect.
            """,
        ),
        passage(
            5,
            3,
            "Message in the Tide",
            """
            Coastal students measured the tide twice a day for a climate project that their town had approved mainly as a classroom exercise.
            They expected small seasonal changes, but the spring records showed a clear rise that matched neither memory nor older tourist photos.
            At first town leaders doubted the data because the numbers threatened expensive plans for new shops near the waterfront.
            The students invited officials to stand on the pier at high tide and compare the waterline with marks painted years earlier.
            Water covered steps that used to stay dry, and the conversation shifted from skepticism to practical risk.
            Within a month the town began designing higher barriers and better drains, using the student tables as a starting baseline.
            The project showed that careful observation can change public decisions when evidence is presented calmly and adults are asked to see it themselves.
            """,
        ),
        passage(
            5,
            4,
            "The Clockmaker's Apprentice",
            """
            In a narrow street workshop, an apprentice spent years learning to repair clocks that cities still treated as public symbols.
            His master insisted that every gear be cleaned as if the reliability of an entire square depended on one unnoticed screw.
            Days before a national ceremony, a rare tower clock stopped, and officials demanded a repair that would not look hurried from the street.
            The apprentice worked through the night, matching tiny parts by candlelight and testing each stage before the next.
            At dawn the clock struck the hour, clear and steady above the square, while few people knew how close it had come to silence.
            The master offered little praise—only a nod and a better set of tools placed on the apprentice's bench.
            Years later the apprentice told students that pride should stay quiet when accuracy is the real product of the work.
            """,
        ),
        passage(
            5,
            5,
            "Flight Across the Canyon",
            """
            Engineers tested a lightweight drone designed to carry emergency medicine across a canyon that blocked ordinary road transport for hours.
            Early flights failed when sudden wind pushed the craft toward the cliffs and forced hard landings that damaged the payload case.
            The team redesigned the wings, added sensors, and trained pilots with simulations that repeated the worst local wind patterns.
            On the final trial the drone crossed in four minutes, landed softly, and delivered antibiotics to a clinic the same afternoon.
            Nurses confirmed the shipment, and the engineers allowed themselves only a short celebration before writing the full failure log.
            Their report listed successful steps beside abandoned designs so later teams would not repeat the same expensive mistakes.
            Winter storms remained the next unsolved problem, but the canyon no longer meant automatic delay for every medical delivery.
            """,
        ),
    ],
    6: [
        passage(
            6,
            1,
            "The Ethics of Tracking",
            """
            A city proposed digital nametags for students, claiming the system would improve attendance records and make lost children easier to locate.
            Supporters argued that accurate counts would also unlock funding formulas that currently reward schools for incomplete data.
            Critics warned that constant tracking trains young people to treat surveillance as ordinary care rather than as a power that needs limits.
            Public meetings grew tense because both sides used the language of protection while disagreeing about what protection should cost.
            Parents asked who would store the data, how long it would remain online, and which agencies could request access without a warrant.
            The city delayed the plan and ordered an independent privacy review before any pilot could begin in classrooms.
            The debate left a sharper question open: how much freedom may be traded for security, and who has the authority to call that trade fair?
            """,
        ),
        passage(
            6,
            2,
            "Language That Shapes Choice",
            """
            Behavioral researchers showed that the wording of a choice can change decisions even when the underlying numbers remain identical.
            When a medical option was framed as "90 percent survival," more patients accepted treatment than when the same option was framed as "10 percent mortality."
            Advertisers and policymakers already exploit framing, sometimes to encourage healthy habits and sometimes to hide trade-offs.
            The study concluded that clear presentation is not merely a communication skill but an ethical responsibility toward people under pressure.
            Readers who notice framing can interrupt automatic agreement and demand a second description of the same facts.
            Teachers began pairing opposite frames in class so students could practice identifying bias before they meet it in real forms and ballots.
            The larger lesson was simple: language does not only report a choice; it can manufacture the feeling that one option is already correct.
            """,
        ),
        passage(
            6,
            3,
            "Restoring a River",
            """
            For decades factories released waste into the Gray River until fish populations collapsed and local fishing families lost seasonal income.
            A coalition of scientists, fishers, and students measured pollution at dozens of points and published results the factories could not easily dismiss.
            Their reports forced older plants to install filters and change waste schedules, though enforcement remained uneven and politically contested.
            Storms occasionally washed stored chemicals into the water, reminding residents that one clean season does not equal recovery.
            Still, within ten years several fish species returned to stretches once labeled dead, and schools treated the river as a long-term field site.
            The project demonstrated that environmental repair is slow, public, and incomplete by design: each generation must re-measure what the last generation claimed to fix.
            Progress, in this case, looked less like a victory parade and more like a shared habit of refusing to look away.
            """,
        ),
        passage(
            6,
            4,
            "The Archive of Voices",
            """
            A university archive collected oral histories from immigrants who arrived after the war, many of whom had never written their experiences for official files.
            Volunteers transcribed hours of recordings, preserving accents, jokes, interruptions, and the silences that followed difficult questions.
            Historians cautioned that memory is selective, yet the recordings still corrected documents that had reduced daily life to dates and border stamps.
            Students who listened often changed research topics after hearing details no policy paper had bothered to record.
            The archive refused to force the material into one neat national story; it presented many unfinished accounts side by side.
            Directors argued that this incompleteness is closer to historical truth than a single polished narrative designed for comfort.
            Families later donated photographs that linked private rooms to public events, tightening the connection between memory and evidence.
            """,
        ),
        passage(
            6,
            5,
            "When Markets Amplify Hits",
            """
            Cultural products such as books and songs can become hits partly because people copy one another's attention rather than judge each work in isolation.
            In connected markets, a small early advantage in visibility may grow into a large gap in sales even when quality differences remain modest.
            Quality still matters, but so does the belief that "everyone else is already reading this," which turns social proof into a ranking engine.
            As a result, predicting success becomes harder for creators, and many carefully made works stay little known despite strong craft.
            Understanding the pattern does not remove chance; it explains why popularity is an unreliable pure measure of merit.
            Critics who teach media literacy often ask students to separate craft, luck, and platform design before they treat a chart position as proof of excellence.
            The market amplifies signals; it does not automatically reward the work that most deserves to last.
            """,
        ),
    ],
}


def resolve_series_name(folder_name: str) -> str | None:
    if folder_name in SERIES_META:
        return folder_name
    return next((k for k in SERIES_META if k.lower() in folder_name.lower()), None)


def index_local_sources(source_root: Path) -> dict:
    """Index local reader files without reading/copying body text into passages."""
    series: list[dict] = []
    if not source_root.exists():
        return {
            "indexedAt": datetime.now(timezone.utc).isoformat(),
            "sourceRoot": str(source_root),
            "note": "source root not found",
            "series": [],
            "byCefr": {},
        }

    # Find nested content root (folder containing series dirs)
    content_roots = [source_root]
    for child in source_root.iterdir():
        if child.is_dir():
            content_roots.append(child)

    found_any = False
    seen: set[str] = set()
    for root in content_roots:
        for series_dir in sorted(root.iterdir() if root.is_dir() else []):
            if not series_dir.is_dir():
                continue
            name = resolve_series_name(series_dir.name)
            if not name or name in seen:
                continue
            meta = SERIES_META[name]
            files = []
            for f in sorted(series_dir.rglob("*")):
                if f.is_file() and f.suffix.lower() in {".docx", ".txt", ".pdf", ".doc"}:
                    files.append(
                        {
                            "name": f.name,
                            "relativePath": str(f.relative_to(source_root)),
                            "bytes": f.stat().st_size,
                        }
                    )
            if not files:
                continue
            found_any = True
            seen.add(name)
            series.append(
                {
                    "series": name,
                    "cefrPrimary": meta["cefrPrimary"],
                    "cefrMin": meta["cefrMin"],
                    "cefrMax": meta["cefrMax"],
                    "cefrNote": meta["cefrNote"],
                    "gleasLevelReference": meta["gleasLevelReference"],
                    "gleasRole": meta["gleasRole"],
                    "fileCount": len(files),
                    "files": files[:50],  # cap listing
                    "copyrightNote": "Local index only. Do not copy commercial book text into the repo.",
                }
            )

    # Group series by CEFR primary band
    by_cefr: dict[str, list[str]] = {band: [] for band in CEFR_BAND_ORDER}
    for s in series:
        band = s["cefrPrimary"]
        by_cefr.setdefault(band, []).append(s["series"])
    # drop empty bands for readability
    by_cefr = {k: v for k, v in by_cefr.items() if v}

    # CEFR → default GLEAS for operators
    cefr_to_gleas = {
        "Pre-A1": 1,
        "A1": 1,
        "A2": 2,
        "A2-B1": 3,
        "B1": 4,
        "B1-B2": 5,
        "B2": 6,
    }

    return {
        "indexedAt": datetime.now(timezone.utc).isoformat(),
        "sourceRoot": str(source_root),
        "policy": {
            "copyCommercialTextIntoRepo": False,
            "useSeriesAsDifficultyReferenceOnly": True,
            "organizeBy": "CEFR first, then GLEAS placement ladder",
            "originalPassagesWrittenFor": "GLEAS L1–L6 / CEFR Pre-A1–B2 placement reading",
        },
        "cefrToGleas": cefr_to_gleas,
        "seriesMeta": SERIES_META,
        "byCefr": by_cefr,
        "series": sorted(
            series,
            key=lambda s: (
                CEFR_BAND_ORDER.index(s["cefrPrimary"])
                if s["cefrPrimary"] in CEFR_BAND_ORDER
                else 99,
                s["series"],
            ),
        ),
        "foundSeries": found_any,
    }


def build_passages_file() -> dict:
    levels: dict[str, dict] = {}
    for lv in range(1, 7):
        items = PASSAGES[lv]
        levels[str(lv)] = {
            "level": lv,
            "passageCount": len(items),
            "passages": items,
            "meta": LEVEL_META[lv],
        }
    return {
        "version": "2.3.0",
        "description": (
            "Original GLEAS level-preset reading passages calibrated by CEFR band. "
            "Local graded readers calibrate L1–L3 only (Pre-A1 … A2–B1). "
            "L4–L6 are academy original only (B1 / B1–B2 / B2). "
            "Commercial book text is NOT included."
        ),
        "policy": {
            "doNotRewritePassage": True,
            "generateItemsFromPassageOnly": True,
            "irtAlignBToLevelTheta": True,
            "gradeLocksDefaultLevel": True,
            "oneItemPerPassageInLevelTest": True,
            "organizeBy": "CEFR first",
            "copyright": "Original academy text only; local reader files are CEFR difficulty references.",
        },
        "cefrLadder": {
            "1": "Pre-A1/A1",
            "2": "A2",
            "3": "A2-B1",
            "4": "B1",
            "5": "B1-B2",
            "6": "B2",
        },
        "levels": levels,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--source",
        type=Path,
        default=Path(
            r"C:\Users\sound\Downloads\영어원서 원문 모음-20260805T230734Z-1-001"
        ),
    )
    args = ap.parse_args()

    catalog = index_local_sources(args.source)
    OUT_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    OUT_CATALOG.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"catalog -> {OUT_CATALOG} series={len(catalog.get('series', []))}")

    data = build_passages_file()
    OUT_PASSAGES.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    for lv in range(1, 7):
        w = [p["wordCount"] for p in data["levels"][str(lv)]["passages"]]
        print(f"L{lv}: n={len(w)} words={w}")
    print(f"passages -> {OUT_PASSAGES}")


if __name__ == "__main__":
    main()
