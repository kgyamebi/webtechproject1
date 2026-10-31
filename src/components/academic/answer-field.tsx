"use client";

import { useState } from "react";
import { Field, Textarea } from "@/components/ui/field";

export function AnswerField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const words = value.trim() === "" ? 0 : value.trim().split(/\s+/).length;

  return (
    <div className="grid gap-2">
      <Field label="Answer" name="body">
        <Textarea id="body" name="body" value={value} onChange={(event) => setValue(event.target.value)} />
      </Field>
      <p className="text-xs text-ink-soft">{words} {words === 1 ? "word" : "words"}</p>
    </div>
  );
}
