// Витягує код підтвердження з тексту листа
export const extractConfirmationCode = (text: string): string | null => {
  // Шукаємо 4-8 цифр підряд
  const match = text.match(/\b\d{4,8}\b/);
  return match ? match[0] : null;
};
