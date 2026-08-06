'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, JSX, KeyboardEvent } from 'react';
import type { SpeciesOption } from '@/types/domain';
import { Button } from '@/components/ui';
import styles from './GuessInput.module.css';

/** Long enough that a two-letter prefix doesn't drag the whole master list. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 140;

function isSpeciesOption(value: unknown): value is SpeciesOption {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.commonName === 'string' &&
    typeof o.scientificName === 'string'
  );
}

export function GuessInput(props: {
  pool: 'curated' | 'master';
  disabled?: boolean;
  onSubmit: (value: string) => void;
  onSkip: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}): JSX.Element {
  const { pool, onSubmit, onSkip } = props;
  const disabled = props.disabled ?? false;
  const placeholder = props.placeholder ?? 'Name the bird…';

  const [value, setValue] = useState('');
  const [options, setOptions] = useState<SpeciesOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Set when the field is filled programmatically, so echoing a chosen name
      back into the box does not immediately reopen the list. */
  const suppressRef = useRef(false);

  const reactId = useId();
  const inputId = `${reactId}-guess`;
  const listId = `${reactId}-listbox`;
  const helpId = `${reactId}-help`;
  const optionId = (index: number) => `${listId}-opt-${index}`;

  const runSearch = useCallback(
    async (query: string) => {
      // A superseded request must never land after its successor: abort first,
      // then own the controller for the duration of this call.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&pool=${encodeURIComponent(pool)}`,
          { signal: controller.signal, headers: { accept: 'application/json' } },
        );
        if (!res.ok) throw new Error(`Search failed with status ${res.status}`);

        const payload: unknown = await res.json();
        const list = Array.isArray(payload) ? payload.filter(isSpeciesOption) : [];

        if (abortRef.current !== controller) return;
        setOptions(list);
        setHighlight(-1);
        setOpen(list.length > 0);
        setError(null);
        setSearched(true);
      } catch {
        if (controller.signal.aborted) return;
        setOptions([]);
        setHighlight(-1);
        setOpen(false);
        setSearched(true);
        setError('Suggestions are unavailable. Type a name and submit it anyway.');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setBusy(false);
        }
      }
    },
    [pool],
  );

  useEffect(() => {
    const suppressed = suppressRef.current;
    suppressRef.current = false;

    const query = value.trim();
    if (query.length < MIN_QUERY) {
      abortRef.current?.abort();
      abortRef.current = null;
      setOptions([]);
      setOpen(false);
      setHighlight(-1);
      setBusy(false);
      setSearched(false);
      setError(null);
      return;
    }
    if (suppressed) return;

    const handle = setTimeout(() => {
      void runSearch(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [value, runSearch]);

  // Abort whatever is in flight when the round ends or the board unmounts.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setHighlight(-1);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    // Indexing children rather than querying by id: `useId` values contain
    // colons, which are not valid unescaped in a selector.
    const node = listRef.current?.children.item(highlight);
    if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  const closeList = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  /** Selection only fills the field. The player always confirms. */
  const acceptOption = useCallback((option: SpeciesOption) => {
    suppressRef.current = true;
    setValue(option.commonName);
    setOptions([]);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  }, []);

  const move = useCallback(
    (delta: number) => {
      if (options.length === 0) return;
      if (!open) {
        setOpen(true);
        setHighlight(delta > 0 ? 0 : options.length - 1);
        return;
      }
      setHighlight((prev) => {
        const next = prev + delta;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
    },
    [open, options.length],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        if (open && options.length > 0) {
          event.preventDefault();
          setHighlight(0);
        }
        break;
      case 'End':
        if (open && options.length > 0) {
          event.preventDefault();
          setHighlight(options.length - 1);
        }
        break;
      case 'Enter': {
        const option = open && highlight >= 0 ? options[highlight] : undefined;
        if (option) {
          // Accepting a suggestion must not also submit it.
          event.preventDefault();
          acceptOption(option);
        } else {
          closeList();
        }
        break;
      }
      case 'Escape':
        // First press dismisses the list, second clears the field.
        if (open) {
          event.preventDefault();
          closeList();
        } else if (value !== '') {
          event.preventDefault();
          suppressRef.current = true;
          setValue('');
        }
        break;
      case 'Tab':
        if (open) closeList();
        break;
      default:
        break;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    closeList();
    const raw = value.trim();
    if (disabled || raw === '') return;
    suppressRef.current = true;
    setValue('');
    setOptions([]);
    onSubmit(raw);
    inputRef.current?.focus();
  };

  const handleSkip = () => {
    if (disabled) return;
    closeList();
    suppressRef.current = true;
    setValue('');
    setOptions([]);
    onSkip();
  };

  const noMatches = searched && !busy && !error && options.length === 0;
  const liveText = error
    ? error
    : open && options.length > 0
      ? `${options.length} suggestion${options.length === 1 ? '' : 's'} available. Use the arrow keys to review them.`
      : noMatches
        ? 'No matching species. You can still submit what you typed.'
        : '';

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className="srOnly" htmlFor={inputId}>
          Your identification — common or scientific name
        </label>

        <div className={styles.inputShell}>
          <input
            id={inputId}
            ref={inputRef}
            className={styles.input}
            type="text"
            value={value}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={open && highlight >= 0 ? optionId(highlight) : undefined}
            aria-describedby={helpId}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={props.autoFocus}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={closeList}
          />
          {busy ? (
            <span className={styles.busy} aria-hidden="true">
              searching
            </span>
          ) : null}
        </div>

        <ul
          id={listId}
          ref={listRef}
          className={styles.listbox}
          role="listbox"
          aria-label="Species suggestions"
          hidden={!open || options.length === 0}
          // Keeps focus in the input so the blur handler never races the click.
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === highlight}
              className={`${styles.option} ${index === highlight ? styles.optionActive : ''}`}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => acceptOption(option)}
            >
              <span className={styles.optionName}>{option.commonName}</span>
              <span className={styles.optionBinomial}>{option.scientificName}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={disabled || value.trim() === ''}>
          Submit
        </Button>
        <Button type="button" variant="ghost" onClick={handleSkip} disabled={disabled}>
          Skip
        </Button>
      </div>

      <p id={helpId} className={`${styles.help} ${error ? styles.helpError : ''}`}>
        {error ?? 'Type a common or scientific name. Arrow keys review suggestions; Enter submits.'}
      </p>

      <div className="srOnly" role="status" aria-live="polite">
        {liveText}
      </div>
    </form>
  );
}
