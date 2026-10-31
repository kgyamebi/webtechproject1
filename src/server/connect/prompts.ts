export const CONNECT_PROMPTS = [
  { category: "Getting to know you", text: "What is something you would love to learn this year?" },
  { category: "Campus life", text: "What is one thing you wish more students did on campus?" },
  { category: "Learning and studying", text: "What subject could you talk about for hours?" },
  { category: "Hobbies", text: "What do you do when you want a break from coursework?" },
  { category: "Technology", text: "What kind of project would you enjoy building with someone?" },
  { category: "Creative projects", text: "What would you make if you had a free weekend?" },
  { category: "Career ambitions", text: "What kind of work are you curious about, even if you have not decided yet?" },
  { category: "Lighthearted questions", text: "What is a small campus habit that makes your week better?" },
] as const;

export function promptAt(index: number): { category: string; text: string } {
  const safe = ((index % CONNECT_PROMPTS.length) + CONNECT_PROMPTS.length) % CONNECT_PROMPTS.length;
  return CONNECT_PROMPTS[safe] ?? CONNECT_PROMPTS[0];
}
