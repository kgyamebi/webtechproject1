"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createStoryAction } from "@/server/social/actions";

export function StoryComposer() {
  const [preview, setPreview] = useState("");

  return (
    <form action={createStoryAction} className="mt-4 grid gap-3">
      <Field label="Image" name="image" hint="JPEG, PNG, or WebP. Friends can see it for 24 hours. There is no video.">
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setPreview("");
              return;
            }
            setPreview(URL.createObjectURL(file));
          }}
        />
      </Field>
      {preview ? <img src={preview} alt="Story preview before sharing" className="max-h-64 w-full rounded-2xl object-cover" /> : null}
      <Field label="Caption" name="caption">
        <Input id="caption" name="caption" maxLength={140} />
      </Field>
      <Button type="submit">Share for 24 hours</Button>
    </form>
  );
}
