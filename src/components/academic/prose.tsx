export function Prose({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className="grid gap-5">
      {blocks.map((block, index) => (
        <div key={index} className="grid gap-2">
          {block.split("\n").map((line, lineIndex) => {
            if (line.startsWith("# ")) {
              return (
                <h2 key={lineIndex} className="font-display text-2xl">
                  {line.slice(2)}
                </h2>
              );
            }
            if (line.startsWith("## ")) {
              return (
                <h3 key={lineIndex} className="text-sm font-medium">
                  {line.slice(3)}
                </h3>
              );
            }
            return (
              <p key={lineIndex} className="text-sm leading-7">
                {line}
              </p>
            );
          })}
        </div>
      ))}
    </div>
  );
}
