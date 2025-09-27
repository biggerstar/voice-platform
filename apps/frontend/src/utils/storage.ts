/**
 * Set a value in localStorage.
 * @param key - The key to set.
 * @param value - The value to set.
 */
export function setStorage<T>(key: string, value: T): void {
  try {
    const stringValue = JSON.stringify(value);
    localStorage.setItem(key, stringValue);
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
}

/**
 * Get a value from localStorage.
 * @param key - The key to get.
 * @returns The stored value, or null if not found or on error.
 */
export function getStorage<T>(key: string): T | null {
  try {
    const stringValue = localStorage.getItem(key);
    if (stringValue === null) {
      return null;
    }
    return JSON.parse(stringValue) as T;
  } catch (error) {
    console.error(`Error getting localStorage key "${key}":`, error);
    return null;
  }
}

/**
 * Remove a value from localStorage.
 * @param key - The key to remove.
 */
export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
  }
}

/**
 * Clear all items from localStorage.
 */
export function clearStorage(): void {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}