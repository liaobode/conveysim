/** 对话框内 Tab 循环锁定 */
export function trapFocus(e: KeyboardEvent, container: HTMLElement): void {
  if (e.key !== 'Tab') return;

  const focusable = container.querySelectorAll<HTMLElement>(
    'input, select, button, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
