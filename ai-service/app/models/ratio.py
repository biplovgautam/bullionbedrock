from pydantic import BaseModel, Field


class RatioUpdate(BaseModel):
    gold: float = Field(..., gt=0)
    silver: float = Field(..., gt=0)
    ratio: float = Field(..., gt=0)
    timestamp: str
