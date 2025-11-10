/**
 * PyTorch Local Inference Server Client
 * Connects to a local FastAPI server running a fine-tuned model
 * 
 * To set up the inference server:
 * 1. Create a FastAPI server with a fine-tuned model
 * 2. Train model using stock_qa_100k.json
 * 3. Expose /infer endpoint
 * 4. Set LOCAL_PYTORCH_ENABLED=true and LOCAL_PYTORCH_URL in .env
 */

const INFERENCE_SERVER_URL = process.env.LOCAL_PYTORCH_URL || 'http://localhost:8000'

export interface PyTorchInferenceRequest {
  question: string
  context: string
  max_length?: number
  temperature?: number
  top_k?: number
  top_p?: number
}

export interface PyTorchInferenceResponse {
  answer: string
  confidence: number
  model_version: string
  latency_ms: number
}

/**
 * Call local PyTorch inference server
 */
export async function inferLocalPyTorch(
  request: PyTorchInferenceRequest
): Promise<PyTorchInferenceResponse> {
  try {
    const response = await fetch(`${INFERENCE_SERVER_URL}/infer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: request.question,
        context: request.context,
        max_length: request.max_length || 512,
        temperature: request.temperature || 0.2,
        top_k: request.top_k || 50,
        top_p: request.top_p || 0.9,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    if (!response.ok) {
      throw new Error(`Inference server error: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      answer: data.answer || 'Unable to generate response',
      confidence: data.confidence || 0.5,
      model_version: data.model_version || 'unknown',
      latency_ms: data.latency_ms || 0,
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Inference server timeout')
    }
    throw error
  }
}

/**
 * Check if local PyTorch server is available
 */
export async function checkPyTorchServer(): Promise<boolean> {
  try {
    const response = await fetch(`${INFERENCE_SERVER_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

