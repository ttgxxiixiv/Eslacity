import { describe, expect, it } from 'vitest';
import { errorDetails } from './ErrorBoundary';

describe('подробности ошибки', () => {
  it('верх стека без строки с сообщением и без адреса сайта, затем стек компонентов', () => {
    const e = new TypeError('l is not a function');
    e.stack = 'TypeError: l is not a function\n    at Pd (https://ttgxxiixiv.github.io/Eslacity/assets/index-zym4ekXT.js:12:34)\n    at Xa (https://ttgxxiixiv.github.io/Eslacity/assets/index-zym4ekXT.js:5:6)';
    expect(errorDetails(e, '\n    at Pd\n    at Nd')).toBe('at Pd (index-zym4ekXT.js:12:34)\nat Xa (index-zym4ekXT.js:5:6)\n—\nat Pd\nat Nd');
  });
});
