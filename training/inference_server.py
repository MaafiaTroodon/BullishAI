"""
Local PyTorch Inference Server for Fine-Tuned Model
Usage: python training/inference_server.py --model ./bullishai-finance-qa --port 8000
"""

import argparse
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI()

class InferenceRequest(BaseModel):
    question: str
    context: str
    max_length: int = 512
    temperature: float = 0.2

class InferenceResponse(BaseModel):
    answer: str
    model: str = "local-pytorch"
    latency_ms: float

model = None
tokenizer = None

def load_model(model_path: str, base_model: str = "meta-llama/Llama-3-8B-Instruct"):
    """Load fine-tuned model"""
    global model, tokenizer
    
    print(f"Loading base model: {base_model}")
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    base = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
    )
    
    print(f"Loading LoRA adapter: {model_path}")
    model = PeftModel.from_pretrained(base, model_path)
    model.eval()
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    print("Model loaded successfully!")

@app.post("/infer", response_model=InferenceResponse)
async def infer(request: InferenceRequest):
    """Generate answer from question and context"""
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    import time
    start_time = time.time()
    
    # Format prompt
    prompt = f"""Context: {request.context}
Question: {request.question}
Answer:"""
    
    # Tokenize
    inputs = tokenizer(prompt, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}
    
    # Generate
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_length=request.max_length,
            temperature=request.temperature,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    
    # Decode
    answer = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # Extract answer part (after "Answer:")
    if "Answer:" in answer:
        answer = answer.split("Answer:")[-1].strip()
    
    latency_ms = (time.time() - start_time) * 1000
    
    return InferenceResponse(
        answer=answer,
        latency_ms=latency_ms,
    )

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy" if model is not None else "not_loaded",
        "model": "local-pytorch",
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, required=True, help="Path to fine-tuned model")
    parser.add_argument("--base-model", type=str, default="meta-llama/Llama-3-8B-Instruct", help="Base model name")
    parser.add_argument("--port", type=int, default=8000, help="Server port")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Server host")
    args = parser.parse_args()
    
    print("Loading model...")
    load_model(args.model, args.base_model)
    
    print(f"Starting server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()

