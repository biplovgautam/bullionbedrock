export const ratioUpdateSchema = {
  type: "object",
  required: ["gold", "silver", "ratio", "timestamp"],
  properties: {
    gold: { type: "number" },
    silver: { type: "number" },
    ratio: { type: "number" },
    timestamp: { type: "string" }
  }
} as const;

export type RatioUpdate = {
  gold: number;
  silver: number;
  ratio: number;
  timestamp: string;
};
