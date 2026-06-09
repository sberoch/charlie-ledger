"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, {
  type KeyboardEvent,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Command as CommandPrimitive } from "cmdk";
import { X as RemoveIcon, Check } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import {
  Command,
  CommandItem,
  CommandEmpty,
  CommandList,
} from "@workspace/ui/components/command";
import { cn } from "@workspace/ui/lib/utils";

interface MultiSelectorProps extends React.ComponentPropsWithoutRef<
  typeof CommandPrimitive
> {
  values: string[];
  onValuesChange: (value: string[]) => void;
  loop?: boolean;
}

interface MultiSelectContextProps {
  value: string[];
  onValueChange: (value: any) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  ref: React.RefObject<HTMLInputElement>;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  handleSelect: (e: React.SyntheticEvent<HTMLInputElement>) => void;
}

const MultiSelectContext = createContext<MultiSelectContextProps | null>(null);

const useMultiSelect = () => {
  const context = useContext(MultiSelectContext);
  if (!context) {
    throw new Error("useMultiSelect must be used within MultiSelectProvider");
  }
  return context;
};

/**
 * MultiSelect Docs: {@link: https://shadcn-extension.vercel.app/docs/multi-select}
 */
const MultiSelector = ({
  values: value,
  onValuesChange: onValueChange,
  loop = false,
  className,
  children,
  dir,
  ...props
}: MultiSelectorProps) => {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [isValueSelected, setIsValueSelected] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState("");

  const onValueChangeHandler = useCallback(
    (val: string) => {
      if (value.includes(val)) {
        onValueChange(value.filter((item) => item !== val));
      } else {
        onValueChange([...value, val]);
      }
    },
    [value, onValueChange],
  );

  const handleSelect = React.useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      e.preventDefault();
      const target = e.currentTarget;
      const selection = target.value.substring(
        target.selectionStart ?? 0,
        target.selectionEnd ?? 0,
      );

      setSelectedValue(selection);
      setIsValueSelected(selection === inputValue);
    },
    [inputValue],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const target = inputRef.current;

      if (!target) return;

      const moveNext = () => {
        const nextIndex = activeIndex + 1;
        setActiveIndex(
          nextIndex > value.length - 1 ? (loop ? 0 : -1) : nextIndex,
        );
      };

      const movePrev = () => {
        const prevIndex = activeIndex - 1;
        setActiveIndex(prevIndex < 0 ? value.length - 1 : prevIndex);
      };

      const moveCurrent = () => {
        const newIndex =
          activeIndex - 1 <= 0
            ? value.length - 1 === 0
              ? -1
              : 0
            : activeIndex - 1;
        setActiveIndex(newIndex);
      };

      switch (e.key) {
        case "ArrowLeft":
          if (dir === "rtl") {
            if (value.length > 0 && (activeIndex !== -1 || loop)) {
              moveNext();
            }
          } else {
            if (value.length > 0 && target.selectionStart === 0) {
              movePrev();
            }
          }
          break;

        case "ArrowRight":
          if (dir === "rtl") {
            if (value.length > 0 && target.selectionStart === 0) {
              movePrev();
            }
          } else {
            if (value.length > 0 && (activeIndex !== -1 || loop)) {
              moveNext();
            }
          }
          break;

        case "Backspace":
        case "Delete":
          if (value.length > 0) {
            if (activeIndex !== -1 && activeIndex < value.length) {
              onValueChangeHandler(value[activeIndex] ?? "");
              moveCurrent();
            } else if (target.selectionStart === 0) {
              if (selectedValue === inputValue || isValueSelected) {
                onValueChangeHandler(value[value.length - 1] ?? "");
              }
            }
          }
          break;

        case "Enter":
          setOpen(true);
          break;

        case "Escape":
          if (activeIndex !== -1) {
            setActiveIndex(-1);
          } else if (open) {
            setOpen(false);
          }
          break;
      }
    },
    [value, inputValue, activeIndex, loop, dir, open, onValueChangeHandler],
  );

  return (
    <MultiSelectContext.Provider
      value={{
        value,
        onValueChange: onValueChangeHandler,
        open,
        setOpen,
        inputValue,
        setInputValue,
        activeIndex,
        setActiveIndex,
        ref: inputRef as React.RefObject<HTMLInputElement>,
        triggerRef,
        handleSelect,
      }}
    >
      <Command
        onKeyDown={handleKeyDown}
        className={cn(
          "overflow-visible bg-transparent flex flex-col gap-2",
          className,
        )}
        dir={dir}
        {...props}
      >
        {children}
      </Command>
    </MultiSelectContext.Provider>
  );
};

const MultiSelectorTrigger = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { value, onValueChange, activeIndex, triggerRef } = useMultiSelect();

  const mousePreventDefault = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const setTriggerRef = useCallback(
    (node: HTMLDivElement | null) => {
      triggerRef.current = node;

      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref, triggerRef],
  );

  return (
    <div
      ref={setTriggerRef}
      className={cn(
        "flex flex-wrap gap-1 p-1 py-2 border border-input rounded-md bg-background transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    >
      {value.map((item, index) => (
        <Badge
          key={item}
          className={cn(
            "px-1.5 py-0.5 rounded-md flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors",
            activeIndex === index && "ring-2 ring-ring",
          )}
          variant="secondary"
        >
          <span className="text-xs font-medium">{item}</span>
          <button
            aria-label={`Remove ${item} option`}
            aria-roledescription="button to remove option"
            type="button"
            onMouseDown={mousePreventDefault}
            onClick={() => onValueChange(item)}
          >
            <span className="sr-only">Remove {item} option</span>
            <RemoveIcon className="h-3.5 w-3.5 text-primary/60 hover:text-destructive transition-colors" />
          </button>
        </Badge>
      ))}
      {children}
    </div>
  );
});

MultiSelectorTrigger.displayName = "MultiSelectorTrigger";

const MultiSelectorInput = forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => {
  const {
    setOpen,
    inputValue,
    setInputValue,
    activeIndex,
    setActiveIndex,
    handleSelect,
    ref: inputRef,
  } = useMultiSelect();

  return (
    <CommandPrimitive.Input
      {...props}
      tabIndex={0}
      ref={inputRef}
      value={inputValue}
      onValueChange={activeIndex === -1 ? setInputValue : undefined}
      onSelect={handleSelect}
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onClick={() => setActiveIndex(-1)}
      className={cn(
        "ml-2 bg-transparent outline-none placeholder:text-muted-foreground text-foreground text-sm flex-1",
        className,
        activeIndex !== -1 && "caret-transparent",
      )}
    />
  );
});

MultiSelectorInput.displayName = "MultiSelectorInput";

const MultiSelectorContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className, ...props }, ref) => {
  const { open, triggerRef } = useMultiSelect();
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, [triggerRef]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open || !coords) {
    return null;
  }

  const content = (
    <div
      ref={ref}
      className={cn("fixed z-50", className)}
      style={{
        top: coords.top,
        left: coords.left,
        width: coords.width,
      }}
      {...props}
    >
      {children}
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
});

MultiSelectorContent.displayName = "MultiSelectorContent";

const MultiSelectorList = forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, children }, ref) => {
  return (
    <CommandList
      ref={ref}
      className={cn(
        "p-1.5 flex flex-col gap-0.5 rounded-md w-full bg-popover text-popover-foreground shadow-md border",
        className,
      )}
    >
      {children}
      <CommandEmpty>
        <span className="text-muted-foreground text-sm">No results</span>
      </CommandEmpty>
    </CommandList>
  );
});

MultiSelectorList.displayName = "MultiSelectorList";

const MultiSelectorItem = forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  { value: string } & React.ComponentPropsWithoutRef<
    typeof CommandPrimitive.Item
  >
>(({ className, value, children, ...props }, ref) => {
  const { value: Options, onValueChange, setInputValue } = useMultiSelect();

  const mousePreventDefault = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const isIncluded = Options.includes(value);
  return (
    <CommandItem
      ref={ref}
      {...props}
      onSelect={() => {
        onValueChange(value);
        setInputValue("");
      }}
      className={cn(
        "rounded-md cursor-pointer px-2.5 py-1.5 text-sm text-foreground transition-colors flex justify-between hover:bg-accent hover:text-accent-foreground",
        className,
        isIncluded && "text-primary bg-accent cursor-default",
        props.disabled && "opacity-50 cursor-not-allowed",
      )}
      onMouseDown={mousePreventDefault}
    >
      {children}
      {isIncluded && <Check className="h-3.5 w-3.5 text-primary" />}
    </CommandItem>
  );
});

MultiSelectorItem.displayName = "MultiSelectorItem";

export {
  MultiSelector,
  MultiSelectorTrigger,
  MultiSelectorInput,
  MultiSelectorContent,
  MultiSelectorList,
  MultiSelectorItem,
};
