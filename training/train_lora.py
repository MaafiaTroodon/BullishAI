"""
PyTorch LoRA Fine-Tuning Script for BullishAI Finance Q&A
Usage: python training/train_lora.py --dataset practice_qa_100k.jsonl
"""

import argparse
import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig, get_peft_model, TaskType
from datasets import load_dataset
import json

def format_prompt(example):
    """Format training example as prompt"""
    context = example.get("context", "")
    question = example["question"]
    answer = example["answer"]
    rationale = example.get("rationale", "")
    risk_note = example.get("risk_note", "")
    
    # Build prompt with context
    prompt_parts = []
    if context:
        prompt_parts.append(f"Context: {context}")
    prompt_parts.append(f"Question: {question}")
    prompt_parts.append(f"Answer: {answer}")
    
    if rationale:
        prompt_parts.append(f"\nRationale: {rationale}")
    if risk_note:
        prompt_parts.append(f"\nRisk Note: {risk_note}")
    
    return {"text": "\n".join(prompt_parts)}

def compute_metrics(eval_pred):
    """Compute evaluation metrics"""
    predictions, labels = eval_pred
    # Placeholder for BLEU/ROUGE computation
    # In production, use nltk or rouge-score library
    return {"loss": 0.0}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=str, default="practice_qa_100k.jsonl", help="Path to JSONL dataset")
    parser.add_argument("--model", type=str, default="meta-llama/Llama-3-8B-Instruct", help="Base model")
    parser.add_argument("--output", type=str, default="./bullishai-finance-qa", help="Output directory")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Batch size")
    parser.add_argument("--learning-rate", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--lora-r", type=int, default=16, help="LoRA rank")
    parser.add_argument("--lora-alpha", type=int, default=32, help="LoRA alpha")
    args = parser.parse_args()
    
    print(f"Loading model: {args.model}")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
    )
    
    # Configure LoRA
    print("Configuring LoRA...")
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.1,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        bias="none",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    # Load dataset
    print(f"Loading dataset: {args.dataset}")
    dataset = load_dataset("json", data_files=args.dataset, split="train")
    
    # Split train/val
    dataset = dataset.train_test_split(test_size=0.1, seed=42)
    
    # Format prompts
    print("Formatting prompts...")
    dataset = dataset.map(format_prompt, remove_columns=dataset["train"].column_names)
    
    # Tokenize
    def tokenize(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=512,
            padding="max_length",
        )
    
    print("Tokenizing dataset...")
    dataset = dataset.map(tokenize, batched=True, remove_columns=["text"])
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        learning_rate=args.learning_rate,
        warmup_steps=100,
        logging_steps=10,
        save_steps=500,
        evaluation_strategy="steps",
        eval_steps=500,
        load_best_model_at_end=True,
        save_total_limit=3,
        fp16=torch.cuda.is_available(),
        report_to="none",
    )
    
    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["test"],
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )
    
    # Train
    print("Starting training...")
    trainer.train()
    
    # Save
    print(f"Saving model to {args.output}")
    trainer.save_model()
    tokenizer.save_pretrained(args.output)
    
    print("Training complete!")

if __name__ == "__main__":
    main()

