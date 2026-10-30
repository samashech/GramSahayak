from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Contract section 3 exact vocabulary strings
LanguageCode = Literal[
    "hi-IN",
    "mr-IN",
    "ta-IN",
    "en-IN",
    "te-IN",
    "bn-IN",
    "gu-IN",
    "kn-IN",
    "ml-IN",
    "pa-IN",
    "od-IN",
]

CategoryType = Literal["schemes", "agri", "health", "education"]
RoleType = Literal["farmer", "asha", "panchayat", "student"]
SpeakerRole = Literal["user", "assistant"]
ModeType = Literal["llm", "extractive"]


class HistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: SpeakerRole
    content: str = Field(..., min_length=1)


class RagQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=1, description="User question in regional or English text")
    language: LanguageCode = Field(default="hi-IN", description="BCP-47 language code from contract vocabulary")
    category: Optional[CategoryType] = Field(default=None, description="Optional category filter")
    role: RoleType = Field(default="farmer", description="Citizen persona role")
    for_voice: bool = Field(default=False, description="True for IVR/voice responses (<=3 short spoken sentences)")
    history: List[HistoryMessage] = Field(default_factory=list, description="Prior conversation turns")

    @field_validator("query")
    @classmethod
    def validate_non_blank_query(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("query must not be empty or whitespace only")
        return cleaned


class SourceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    category: CategoryType
    helpline: str
    portal: str


class RagQueryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str
    sources: List[SourceItem] = Field(default_factory=list)
    matched_scheme_id: Optional[str] = None
    sms_summary: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    mode: ModeType
    latency_ms: int = Field(..., ge=0)


class RagIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_path: str = Field(..., min_length=1)
    category: CategoryType


class RagIngestResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ingested_chunks: int = Field(..., ge=0)
    vector_count: int = Field(..., ge=0)


class RetrieveChunkItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    category: CategoryType
    text: str
    score: float


class RagRetrieveResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chunks: List[RetrieveChunkItem] = Field(default_factory=list)
    matched_scheme_id: Optional[str] = None


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "degraded"]
    vector_count: int = Field(..., ge=0)
    embedding_model: str
    mode: ModeType
