# PyTorch Fine-Tuning for BullishAI Finance Q&A Bot

## Overview

This directory contains the training infrastructure for fine-tuning a finance-specific Q&A model using PyTorch and LoRA/QLoRA.

## Dataset Structure

The training dataset (`practice_qa_100k.jsonl`) should follow this JSONL format:

```json
{
  "question": "User question about stocks/finance",
  "answer": "Model response with <PLACEHOLDER> for dynamic values",
  "rationale": "Explanation of why this answer is correct",
  "tickers": ["AAPL", "TSLA"],
  "citations": [{"source": "api_name", "timestamp": "<TIMESTAMP>"}],
  "context_required": true,
  "risk_note": "Optional risk disclaimer"
}
```

### Key Principles

1. **Normalize Numbers**: Use placeholders like `<PRICE>`, `<TIMESTAMP>`, `<CHANGE>` instead of actual values
2. **Require Context**: Mark `context_required: true` for answers that need live data
3. **Include Citations**: Always cite sources for factual claims
4. **Risk Notes**: Include disclaimers for investment-related answers

## Training Setup

### Prerequisites

```bash
pip install torch transformers peft datasets accelerate bitsandbytes
```

### Model Options

- **Base Model**: `meta-llama/Llama-3-8B-Instruct` or `mistralai/Mistral-7B-Instruct-v0.2`
- **Method**: LoRA (Low-Rank Adaptation) or QLoRA (4-bit quantization)
- **Objective**: Supervised Fine-Tuning (SFT) on question-context-answer pairs

### Training Script

```python
# training/train_lora.py
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model, TaskType
from datasets import load_dataset

# Load base model
model_name = "meta-llama/Llama-3-8B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

# Configure LoRA
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,
    lora_alpha=32,
    lora_dropout=0.1,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"]
)
model = get_peft_model(model, lora_config)

# Load dataset
dataset = load_dataset("json", data_files="practice_qa_100k.jsonl", split="train")
dataset = dataset.train_test_split(test_size=0.1)

# Format prompts
def format_prompt(example):
    context = example.get("context", "")
    question = example["question"]
    answer = example["answer"]
    
    prompt = f"""Context: {context}
Question: {question}
Answer: {answer}"""
    return {"text": prompt}

dataset = dataset.map(format_prompt)

# Training arguments
training_args = TrainingArguments(
    output_dir="./bullishai-finance-qa",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    warmup_steps=100,
    logging_steps=10,
    save_steps=500,
    evaluation_strategy="steps",
    eval_steps=500,
    load_best_model_at_end=True,
    metric_for_best_model="rouge",
)

# Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
)

# Train
trainer.train()
trainer.save_model()
```

## Evaluation

### Automatic Metrics

- **BLEU**: N-gram overlap with reference answers
- **ROUGE**: Recall-oriented evaluation
- **Factuality**: Check if cited numbers match context
- **Citation Rate**: Percentage of answers with citations

### Human Evaluation Rubrics

1. **Clarity**: Is the answer easy to understand?
2. **Correctness**: Are facts accurate?
3. **Risk Flag**: Are disclaimers present?
4. **Number Accuracy**: Do numbers match context?

## Serving

### Export to GGUF (Optional)

```bash
python convert_to_gguf.py --model ./bullishai-finance-qa --out ./bullishai-finance-qa.gguf
```

### Inference Server

```python
# training/inference_server.py
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch

base_model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3-8B-Instruct")
model = PeftModel.from_pretrained(base_model, "./bullishai-finance-qa")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3-8B-Instruct")

def generate_answer(question: str, context: str) -> str:
    prompt = f"Context: {context}\nQuestion: {question}\nAnswer:"
    inputs = tokenizer(prompt, return_tensors="pt")
    outputs = model.generate(**inputs, max_length=512, temperature=0.2)
    return tokenizer.decode(outputs[0], skip_special_tokens=True)
```

## Integration

The trained model is integrated via `lib/ai-router.ts`:

1. Set `LOCAL_PYTORCH_ENABLED=true` in environment
2. Start inference server on localhost:8000
3. Router will call local model for domain-specific queries

## Next Steps

1. Collect and label 100k+ question-answer pairs
2. Normalize all numbers to placeholders
3. Train LoRA adapter
4. Evaluate on held-out test set
5. Deploy inference server
6. Integrate with production router

