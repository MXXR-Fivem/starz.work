from io import BytesIO
import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from starlette.datastructures import UploadFile
import spacy

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

nlp = spacy.load("en_core_web_sm")

MAX_KEYWORDS = 45
MAX_DISPLAYED_KEYWORDS = 25
CORE_KEYWORDS = {
    "angular",
    "api",
    "astro",
    "aws",
    "azure",
    "backend",
    "bun",
    "c#",
    "c++",
    "ci",
    "ci/cd",
    "css",
    "cypress",
    "devops",
    "django",
    "docker",
    "docker compose",
    "elasticsearch",
    "express",
    "fastapi",
    "figma",
    "firebase",
    "flask",
    "flutter",
    "frontend",
    "git",
    "github",
    "gitlab",
    "go",
    "graphql",
    "html",
    "ios",
    "java",
    "javascript",
    "jest",
    "jira",
    "kotlin",
    "kubernetes",
    "laravel",
    "linux",
    "machine learning",
    "mongodb",
    "mysql",
    "nestjs",
    "next.js",
    "next",
    "nlp",
    "node",
    "node.js",
    "nuxt",
    "php",
    "playwright",
    "postgresql",
    "prisma",
    "pytorch",
    "python",
    "react",
    "react native",
    "redis",
    "rest",
    "ruby",
    "rust",
    "spring",
    "sql",
    "svelte",
    "swift",
    "symfony",
    "tailwind",
    "tensorflow",
    "terraform",
    "typescript",
    "vue",
    "vue.js",
    "webassembly",
}

TOOL_KEYWORDS = {
    "ansible",
    "azure devops",
    "bitbucket",
    "docker swarm",
    "gcp",
    "github actions",
    "gitlab ci",
    "grafana",
    "helm",
    "jenkins",
    "kafka",
    "kibana",
    "nginx",
    "prometheus",
    "rabbitmq",
    "sonarqube",
    "vite",
}

METHOD_KEYWORDS = {
    "accessibility",
    "agile",
    "clean architecture",
    "ddd",
    "e2e tests",
    "microservices",
    "scrum",
    "tdd",
    "unit tests",
}

TECH_KEYWORD_WEIGHTS = {
    **{keyword: 3 for keyword in CORE_KEYWORDS},
    **{keyword: 2 for keyword in TOOL_KEYWORDS},
    **{keyword: 1 for keyword in METHOD_KEYWORDS},
}
TECH_KEYWORDS = set(TECH_KEYWORD_WEIGHTS.keys())

COMMON_WORDS = {
    "accept",
    "access",
    "action",
    "application",
    "apply",
    "business",
    "company",
    "day",
    "developer",
    "development",
    "engineer",
    "experience",
    "good",
    "great",
    "help",
    "join",
    "make",
    "offer",
    "people",
    "product",
    "project",
    "role",
    "team",
    "today",
    "tool",
    "user",
    "week",
    "work",
    "year",
}


class AnalyzeRequest(BaseModel):
    offer: str
    cv: str


def normalize_keyword(value: str) -> str:
    normalized = value.strip().lower()
    normalized = normalized.replace("nodejs", "node.js")
    normalized = normalized.replace("nextjs", "next.js")
    normalized = normalized.replace("vuejs", "vue.js")
    normalized = normalized.replace("reactjs", "react")
    normalized = normalized.replace("ci cd", "ci/cd")
    normalized = normalized.replace("cicd", "ci/cd")
    return re.sub(r"\s+", " ", normalized)


def keyword_pattern(keyword: str) -> str:
    return rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])"


def keyword_weight(keyword: str) -> int:
    return TECH_KEYWORD_WEIGHTS.get(keyword, 2)


def sort_keywords_by_importance(keywords: set) -> list:
    return sorted(keywords, key=lambda keyword: (-keyword_weight(keyword), keyword))


def extract_skill_line_keywords(offer: str) -> set:
    keywords = set()

    for line in offer.splitlines():
        if not line.lower().startswith("skills:"):
            continue

        raw_skills = line.split(":", 1)[1].split(",")
        for raw_skill in raw_skills:
            skill = normalize_keyword(raw_skill)
            if len(skill) > 1:
                keywords.add(skill)

    return keywords


def extract_technical_keywords(text: str) -> set:
    normalized_text = normalize_keyword(text)
    found = {
        keyword
        for keyword in TECH_KEYWORDS
        if re.search(keyword_pattern(keyword), normalized_text)
    }

    doc = nlp(normalized_text)
    keywords = set()
    for token in doc:
        if (
            not token.is_stop
            and not token.is_punct
            and token.is_alpha
            and len(token.lemma_) > 3
            and token.lemma_ not in COMMON_WORDS
            and token.lemma_ in TECH_KEYWORDS
        ):
            keywords.add(token.lemma_)

    return found | keywords


def extract_offer_keywords(offer: str) -> set:
    keywords = extract_skill_line_keywords(offer) | extract_technical_keywords(offer)
    return set(sort_keywords_by_importance(keywords)[:MAX_KEYWORDS])


def extract_cv_keywords(cv: str, offer_keywords: set) -> set:
    cv_text = normalize_keyword(cv)

    return {
        keyword
        for keyword in offer_keywords
        if re.search(keyword_pattern(keyword), cv_text)
    }


def compute_weighted_score(offer_keywords: set, found_keywords: set) -> int:
    total_weight = sum(keyword_weight(keyword) for keyword in offer_keywords)
    if total_weight <= 0:
        return 0

    found_weight = sum(keyword_weight(keyword) for keyword in found_keywords)
    return round((found_weight / total_weight) * 100)


def get_match_level(score: int) -> str:
    if score >= 70:
        return "strong_match"

    if score >= 40:
        return "partial_match"

    return "weak_match"


def build_suggestions(missing_keywords: set) -> list:
    important_missing_keywords = sort_keywords_by_importance(missing_keywords)[:5]

    return [
        f"Si vous maîtrisez {keyword}, ajoutez-le clairement dans votre CV."
        for keyword in important_missing_keywords
    ]


async def extract_file_text(file: UploadFile) -> str:
    content = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".pdf") or file.content_type == "application/pdf":
        reader = PdfReader(BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    return content.decode("utf-8", errors="ignore")


def build_result(offer: str, cv: str) -> dict:
    keywords_offre = extract_offer_keywords(offer)
    keywords_cv = extract_cv_keywords(cv, keywords_offre)

    trouves = keywords_offre & keywords_cv
    manquants = keywords_offre - keywords_cv

    score = compute_weighted_score(keywords_offre, trouves)

    return {
        "score": score,
        "match_level": get_match_level(score),
        "keywords_offre": sort_keywords_by_importance(keywords_offre)[:MAX_DISPLAYED_KEYWORDS],
        "keywords_trouves": sort_keywords_by_importance(trouves)[:MAX_DISPLAYED_KEYWORDS],
        "keywords_manquants": sort_keywords_by_importance(manquants)[:MAX_DISPLAYED_KEYWORDS],
        "suggestions": build_suggestions(manquants),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(request: Request):
    content_type = request.headers.get("content-type", "")

    if (
        content_type.startswith("multipart/form-data")
        or content_type.startswith("application/x-www-form-urlencoded")
    ):
        form = await request.form()
        offer = str(form.get("offer") or "")
        cv = str(form.get("cv") or "")
        file = form.get("file")

        if isinstance(file, UploadFile):
            cv = await extract_file_text(file)
    else:
        payload = AnalyzeRequest(**await request.json())
        offer = payload.offer
        cv = payload.cv

    if not offer.strip() or not cv.strip():
        raise HTTPException(status_code=400, detail="offer and cv are required")

    return build_result(offer, cv)
