"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  disabled?: boolean;
  /** Opciones consecutivas con el mismo grupo se muestran bajo un encabezado. */
  group?: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean | string;
  id?: string;
  name?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  /** Muestra un buscador; por defecto se activa con listas largas. */
  searchable?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const SEARCH_THRESHOLD = 8;
const DROPDOWN_GAP = 6;
const DROPDOWN_MAX_HEIGHT = 300;
const VIEWPORT_MARGIN = 8;

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar opción...",
  disabled = false,
  error,
  id,
  name,
  className = "",
  size = "md",
  icon,
  searchable,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  useEffect(() => setMounted(true), []);

  const selectedOption = options.find((opt) => opt.value === value);
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const visibleOptions = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return options;
    return options.filter((opt) =>
      normalize(
        `${opt.label} ${opt.description ?? ""} ${opt.badge ?? ""} ${opt.group ?? ""}`,
      ).includes(term),
    );
  }, [options, query]);

  const close = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow =
      window.innerHeight - rect.bottom - DROPDOWN_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - DROPDOWN_GAP - VIEWPORT_MARGIN;
    const placement =
      spaceBelow < 200 && spaceAbove > spaceBelow ? "top" : "bottom";
    const maxHeight = Math.min(
      DROPDOWN_MAX_HEIGHT,
      placement === "bottom" ? spaceBelow : spaceAbove,
    );
    const dropdownHeight = Math.min(
      dropdownRef.current?.offsetHeight ?? maxHeight,
      maxHeight,
    );
    const width = Math.max(rect.width, 200);
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN),
    );
    const top =
      placement === "bottom"
        ? rect.bottom + DROPDOWN_GAP
        : rect.top - DROPDOWN_GAP - dropdownHeight;
    setPosition({ top, left, width, maxHeight, placement });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, visibleOptions.length, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      close();
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, close, updatePosition]);

  useEffect(() => {
    if (isOpen && showSearch) searchRef.current?.focus({ preventScroll: true });
  }, [isOpen, showSearch]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(
      `[data-index="${highlightedIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, isOpen]);

  const firstEnabledFrom = (
    start: number,
    step: 1 | -1,
    list: SelectOption[] = visibleOptions,
  ) => {
    for (let i = start; i >= 0 && i < list.length; i += step) {
      if (!list[i].disabled) return i;
    }
    return -1;
  };

  const open = () => {
    if (disabled) return;
    const currentIndex = options.findIndex((opt) => opt.value === value);
    setHighlightedIndex(
      currentIndex >= 0 ? currentIndex : firstEnabledFrom(0, 1, options),
    );
    setIsOpen(true);
  };

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!isOpen) return open();
        const next = firstEnabledFrom(highlightedIndex + 1, 1);
        if (next >= 0) setHighlightedIndex(next);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!isOpen) return open();
        const prev = firstEnabledFrom(highlightedIndex - 1, -1);
        if (prev >= 0) setHighlightedIndex(prev);
        break;
      }
      case "Enter": {
        event.preventDefault();
        if (!isOpen) return open();
        const opt = visibleOptions[highlightedIndex];
        if (opt) handleSelect(opt);
        break;
      }
      case " ": {
        // En el buscador el espacio se escribe; en el botón abre la lista.
        if (event.target === searchRef.current) return;
        event.preventDefault();
        if (!isOpen) open();
        break;
      }
      case "Escape": {
        if (!isOpen) return;
        // Evita que el drawer o modal contenedor se cierre junto con la lista.
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      }
      case "Tab":
        if (isOpen) close();
        break;
    }
  };

  const dropdown =
    isOpen && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            className={`custom-select-dropdown is-portal placement-${position?.placement ?? "bottom"}`}
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: position?.width,
              maxHeight: position?.maxHeight,
            }}
            onKeyDown={handleKeyDown}
          >
            {showSearch && (
              <div className="custom-select-search">
                <AppIcon name="search" size={14} />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Buscar..."
                  aria-label="Buscar opción"
                  aria-controls={listboxId}
                  autoComplete="off"
                />
              </div>
            )}
            <ul
              ref={listRef}
              id={listboxId}
              className="custom-select-list"
              role="listbox"
              aria-labelledby={selectId}
            >
              {visibleOptions.length === 0 ? (
                <li className="custom-select-empty">
                  {query
                    ? "Sin resultados para la búsqueda"
                    : "No hay opciones disponibles"}
                </li>
              ) : (
                visibleOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const startsGroup =
                    Boolean(opt.group) &&
                    opt.group !== visibleOptions[idx - 1]?.group;
                  return (
                    <React.Fragment key={`${opt.value}-${idx}`}>
                      {startsGroup && (
                        <li className="custom-select-group" role="presentation">
                          {opt.group}
                        </li>
                      )}
                      <li
                        data-index={idx}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={opt.disabled || undefined}
                        className={[
                          "custom-select-option",
                          isSelected && "is-selected",
                          idx === highlightedIndex && "is-highlighted",
                          opt.disabled && "is-disabled",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelect(opt)}
                        onMouseEnter={() =>
                          !opt.disabled && setHighlightedIndex(idx)
                        }
                      >
                        <div className="option-content">
                          {opt.icon && (
                            <span className="option-icon">{opt.icon}</span>
                          )}
                          <div className="option-text-group">
                            <span className="option-label">{opt.label}</span>
                            {opt.description && (
                              <small className="option-description">
                                {opt.description}
                              </small>
                            )}
                          </div>
                          {opt.badge && (
                            <span className="option-badge">{opt.badge}</span>
                          )}
                        </div>
                        {isSelected && (
                          <AppIcon
                            name="check"
                            size={16}
                            className="option-check-icon"
                          />
                        )}
                      </li>
                    </React.Fragment>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={containerRef}
      className={`custom-select-container size-${size} ${isOpen ? "is-open" : ""} ${
        disabled ? "is-disabled" : ""
      } ${error ? "has-error" : ""} ${className}`}
    >
      {name && <input type="hidden" name={name} value={value} />}

      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        className="custom-select-trigger"
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={
          ariaLabel
            ? `${ariaLabel}${selectedOption ? `: ${selectedOption.label}` : ""}`
            : undefined
        }
        aria-describedby={ariaDescribedBy}
        aria-invalid={error ? true : undefined}
      >
        <div className="select-trigger-content">
          {icon && <span className="select-trigger-prefix-icon">{icon}</span>}
          {selectedOption ? (
            <div className="select-selected-value">
              {selectedOption.icon && (
                <span className="option-icon">{selectedOption.icon}</span>
              )}
              <span className="option-label">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="option-badge">{selectedOption.badge}</span>
              )}
            </div>
          ) : (
            <span className="select-placeholder">{placeholder}</span>
          )}
        </div>

        <AppIcon
          name="chevronDown"
          size={16}
          className={`select-chevron ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {dropdown}
    </div>
  );
}
