import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"

const Combobox = ComboboxPrimitive.Root
const ComboboxTrigger = ComboboxPrimitive.Trigger
const ComboboxInput = React.forwardRef(({ className, ...props }, ref) => (
  <ComboboxPrimitive.Input
    ref={ref}
    className={cn("h-9 w-full bg-transparent px-3 text-xs font-semibold outline-none placeholder:text-zinc-500", className)}
    {...props}
  />
))
ComboboxInput.displayName = "ComboboxInput"

const ComboboxContent = React.forwardRef(({ className, ...props }, ref) => (
  <ComboboxPrimitive.Portal>
    <ComboboxPrimitive.Positioner side="bottom" align="start" sideOffset={4} className="z-[99999999]">
      <ComboboxPrimitive.Popup
        ref={ref}
        className={cn("w-[240px] min-w-[240px] overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-md outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100", className)}
        {...props}
      />
    </ComboboxPrimitive.Positioner>
  </ComboboxPrimitive.Portal>
))
ComboboxContent.displayName = "ComboboxContent"

const ComboboxEmpty = React.forwardRef(({ className, ...props }, ref) => (
  <ComboboxPrimitive.Empty
    ref={ref}
    className={cn("px-2 pt-2 pb-0 text-left text-xs font-semibold text-zinc-500 empty:p-0", className)}
    {...props}
  />
))
ComboboxEmpty.displayName = "ComboboxEmpty"

const ComboboxList = React.forwardRef(({ className, ...props }, ref) => (
  <ComboboxPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden p-1", className)}
    {...props}
  />
))
ComboboxList.displayName = "ComboboxList"

const ComboboxItem = React.forwardRef(({ className, ...props }, ref) => (
  <ComboboxPrimitive.Item
    ref={ref}
    className={cn("relative flex w-full cursor-default select-none items-center rounded-md px-2 py-1 text-xs font-semibold outline-none data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800", className)}
    {...props}
  />
))
ComboboxItem.displayName = "ComboboxItem"

const ComboboxSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <ComboboxPrimitive.Separator
    ref={ref}
    className={cn("my-0 h-px bg-zinc-200 dark:bg-zinc-800", className)}
    {...props}
  />
))
ComboboxSeparator.displayName = "ComboboxSeparator"

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
}
