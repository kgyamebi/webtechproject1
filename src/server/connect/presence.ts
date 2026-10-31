const typingUntil = new Map<string, number>();

export function noteTyping(scope: string, userId: string) {
  typingUntil.set(`${scope}:${userId}`, Date.now() + 4000);
}

export function partnerTyping(scope: string, userId: string) {
  return (typingUntil.get(`${scope}:${userId}`) ?? 0) > Date.now();
}
