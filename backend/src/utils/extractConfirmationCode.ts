export const extractConfirmationCode = (text: string): string | null => {
  // Ищем 4–8 цифр подряд (например 1234, 482951)
  const match = text.match(/\b\d{4,8}\b/);
  return match ? match[0] : null;
};
