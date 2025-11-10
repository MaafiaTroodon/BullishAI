#!/usr/bin/env python3
"""
PyTorch Inference Server
FastAPI server for serving fine-tuned model

Requirements:
- fastapi
- uvicorn
- torch
- transformers
- peft

Usage:
    python scripts/pytorch-inference-server.py
    Or: uvicorn scripts.pytorch-inference_server:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import time
import os

app = FastAPI(title="BullishAI PyTorch Inference Server")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model and tokenizer
model = None
tokenizer = None
MODEL_PATH = os.getenv("MODEL_PATH", "models/finetuned-stock-qa")
BASE_MODEL = os.getenv("BASE_MODEL", "microsoft/DialoGPT-medium")

class InferenceRequest(BaseModel):
    question: str
    context: str = ""
    max_length: int = 512
    temperature: float = 0.2
    top_k: int = 50
    top_p: float = 0.9

class InferenceResponse(BaseModel):
    answer: str
    confidence: float
    model_version: str
    latency_ms: int

def load_model():
    """Load fine-tuned model"""
    global model, tokenizer
    
    if model is not None:
        return
    
    print(f"Loading model from {MODEL_PATH}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH or BASE_MODEL)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    # Load LoRA weights if available
    if os.path.exists(MODEL_PATH):
        model = PeftModel.from_pretrained(base_model, MODEL_PATH)
        model = model.merge_and_unload()
    else:
        model = base_model
    
    model.eval()
    print("Model loaded!")

@app.on_event("startup")
async def startup():
    load_model()

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/infer", response_model=InferenceResponse)
async def infer(request: InferenceRequest):
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    start_time = time.time()
    
    try:
        # Format prompt
        prompt = f"Question: {request.question}\n"
        if request.context:
            prompt = f"Context: {request.context}\n{prompt}"
        prompt += "Answer:"
        
        # Tokenize
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(model.device) for k, v in inputs.items()}
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_length=request.max_length,
                temperature=request.temperature,
                top_k=request.top_k,
                top_p=request.top_p,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )
        
        # Decode
        generated = tokenizer.decode(outputs[0], skip_special_tokens=True)
        answer = generated.split("Answer:")[-1].strip()
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Simple confidence (based on length and completeness)
        confidence = min(1.0, len(answer) / 100.0)
        
        return InferenceResponse(
            answer=answer,
            confidence=confidence,
            model_version="1.0.0",
            latency_ms=latency_ms
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

