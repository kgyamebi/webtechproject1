"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createStoryAction } from "@/server/social/actions";

export function StoryComposer({ friends = [] }: { friends?: { id: string; name: string }[] }) {
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
      {friends.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm">Named circle</legend>
          <p className="text-xs text-ink-soft">Leave everyone unchecked and every friend can see it. Check people to limit this story to them.</p>
          {friends.map((friend) => (
            <label key={friend.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="circle" value={friend.id} />
              {friend.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <Button type="submit">Share for 24 hours</Button>
    </form>
  );
}
