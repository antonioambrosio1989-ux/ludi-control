import type {
  MatchProcessingContext,
} from "./MatchProcessingContext";

export type EngineExecutionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
};

export interface MatchEngine<TOutput> {
  readonly name: string;

  execute(
    context: MatchProcessingContext,
  ): Promise<TOutput> | TOutput;
}