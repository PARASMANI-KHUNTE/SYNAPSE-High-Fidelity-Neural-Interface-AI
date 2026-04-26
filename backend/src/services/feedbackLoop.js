import { evaluateQuality, shouldRequestCorrection } from "./qualityEvaluator.js";
import { generateResponseStream } from "./llm.js";
import { buildChatMessages } from "./chatContext.js";
import perceptionService from "./perceptionService.js";

const MAX_CORRECTION_ATTEMPTS = 2;
const MIN_SCORE_THRESHOLD = 0.6;

const getSystemPrompt = (attempt = 1) => `
You are performing self-correction on a previous response.
This is attempt #${attempt} of ${MAX_CORRECTION_ATTEMPTS}.

Your task is to improve the response based on quality evaluation feedback:
- Fix identified issues with accuracy, completeness, safety, or coherence
- Remove or flag claims that cannot be verified
- Add appropriate uncertainty language for unverified claims
- Ensure the response is helpful and truthful

Guidelines:
- If you cannot verify a fact, say so explicitly
- Use "According to available data..." or "I could not verify..." for unconfirmed claims
- Do not make up information to fill gaps
- Be concise - focus on the issues, don't rewrite the entire response

Output ONLY the corrected response, with no meta-commentary.
`.trim();

export const selfCorrect = async ({
  originalResponse,
  userQuery,
  evaluation,
  context = {},
  onChunk,
  abortSignal
}) => {
  if (!shouldRequestCorrection(evaluation)) {
    return { success: false, reason: "Quality acceptable - no correction needed", response: originalResponse };
  }

  if (evaluation.attempts >= MAX_CORRECTION_ATTEMPTS) {
    return { success: false, reason: "Max correction attempts reached", response: originalResponse };
  }

  const attempt = (evaluation.attempts || 0) + 1;
  const contextMessages = buildChatMessages({
    chatMessages: [],
    userMessage: userQuery,
    currentUserMessage: {
      content: `Original query: ${userQuery}\n\nOriginal response:\n${originalResponse}\n\nQuality issues: ${evaluation.flags.join(", ")}\n\nPlease correct the response addressing these issues.`
    },
    operatorName: context.operatorName || "Operator",
    queryType: "CORRECTION",
    requiresLiveData: false,
    liveDataAvailable: false,
    voiceGender: context.voiceGender || "male",
    emotion: perceptionService.getEmotion()
  }, true);

  contextMessages.unshift({
    role: "system",
    content: getSystemPrompt(attempt)
  });

  try {
    const correctedResponse = await generateResponseStream(
      contextMessages,
      onChunk,
      abortSignal,
      context.model
    );

    const newEvaluation = evaluateQuality(correctedResponse, {
      userQuery,
      hasLiveData: context.hasLiveData || false,
      citationsCount: context.citationsCount || 0
    });

    if (newEvaluation.overallScore >= MIN_SCORE_THRESHOLD || attempt >= MAX_CORRECTION_ATTEMPTS) {
      return {
        success: true,
        response: correctedResponse,
        evaluation: { ...newEvaluation, attempts: attempt },
        attempts: attempt,
        improved: newEvaluation.overallScore > evaluation.overallScore
      };
    }

    return {
      success: false,
      reason: "Correction did not meet quality threshold",
      response: correctedResponse,
      evaluation: { ...newEvaluation, attempts: attempt },
      attempts: attempt
    };
  } catch (err) {
    return {
      success: false,
      reason: `Correction failed: ${err.message}`,
      response: originalResponse,
      error: err.message
    };
  }
};

export const correctWithFeedbackLoop = async ({
  response,
  userQuery,
  context = {},
  onChunk,
  abortSignal
}) => {
  const evaluation = evaluateQuality(response, {
    userQuery,
    hasLiveData: context.hasLiveData || false,
    citationsCount: context.citationsCount || 0,
    toolExecutions: context.toolExecutions || 0
  });

  if (!shouldRequestCorrection(evaluation)) {
    return {
      response,
      evaluation,
      corrected: false,
      attempts: 0
    };
  }

  let currentResponse = response;
  let currentEvaluation = evaluation;
  let attempts = 0;
  const history = [{ response, evaluation }];

  while (attempts < MAX_CORRECTION_ATTEMPTS && currentEvaluation.overallScore < MIN_SCORE_THRESHOLD) {
    const result = await selfCorrect({
      originalResponse: currentResponse,
      userQuery,
      evaluation: currentEvaluation,
      context: { ...context, attempts },
      onChunk,
      abortSignal
    });

    attempts++;
    
    if (result.success || result.evaluation) {
      currentResponse = result.response;
      currentEvaluation = result.evaluation;
      history.push({ response: currentResponse, evaluation: currentEvaluation });

      if (currentEvaluation.overallScore >= MIN_SCORE_THRESHOLD) {
        return {
          response: currentResponse,
          evaluation: currentEvaluation,
          corrected: true,
          attempts,
          history
        };
      }
    }

    if (!result.success && result.reason?.includes("Max attempts")) {
      break;
    }
  }

  return {
    response: currentResponse,
    evaluation: currentEvaluation,
    corrected: currentEvaluation.overallScore > evaluation.overallScore,
    attempts,
    history
  };
};

export const getImprovementSummary = (history = []) => {
  if (history.length < 2) return null;

  const first = history[0].evaluation;
  const last = history[history.length - 1].evaluation;

  return {
    originalScore: first.overallScore,
    finalScore: last.overallScore,
    improvement: last.overallScore - first.overallScore,
    attempts: history.length - 1,
    dimensionsImproved: QUALITY_DIMENSIONS.filter(d => last.scores[d.key] > first.scores[d.key]).map(d => d.key)
  };
};

export default {
  selfCorrect,
  correctWithFeedbackLoop,
  getImprovementSummary
};

const QUALITY_DIMENSIONS = [
  { key: "accuracy", label: "Factual Accuracy" },
  { key: "completeness", label: "Completeness" },
  { key: "coherence", label: "Logical Coherence" },
  { key: "safety", label: "Safety & Truthfulness" },
  { key: "usefulness", label: "Helpfulness" }
];