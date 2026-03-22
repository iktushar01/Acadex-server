/**
 * Generates a random alphanumeric join code for classrooms.
 * Example outputs: A7K9X2, BD23CS, CLS789
 * Default length is 6 characters.
 */
export const generateJoinCode = (length: number = 6): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
