import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  Keyboard,
} from "@capacitor/keyboard";

import type {
  PluginListenerHandle,
} from "@capacitor/core";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: "sheet" | "center";
  labelledBy?: string;
  dismissible?: boolean;
  keyboardAvoiding?: boolean;
}

const FOCUSABLE_ELEMENTS = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/*
 * Keep track of currently mounted Modal instances.
 *
 * This prevents one closing modal from restoring body
 * scrolling while another Modal is still open.
 */
const openModalStack: symbol[] = [];

let savedBodyOverflow = "";

function registerOpenModal(
  modalId: symbol
): void {
  if (
    openModalStack.length === 0
  ) {
    savedBodyOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";
  }

  openModalStack.push(
    modalId
  );
}

function unregisterOpenModal(
  modalId: symbol
): void {
  const index =
    openModalStack.lastIndexOf(
      modalId
    );

  if (index !== -1) {
    openModalStack.splice(
      index,
      1
    );
  }

  if (
    openModalStack.length === 0
  ) {
    document.body.style.overflow =
      savedBodyOverflow;
  }
}

function isTopModal(
  modalId: symbol
): boolean {
  return (
    openModalStack[
      openModalStack.length - 1
    ] === modalId
  );
}

export function Modal({
  open,
  onClose,
  children,
  variant = "sheet",
  labelledBy,
  dismissible = true,
  keyboardAvoiding = false,
}: ModalProps) {
  const dialogRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    keyboardHeight,
    setKeyboardHeight,
  ] = useState<number>(0);

  const previouslyFocusedElement =
    useRef<HTMLElement | null>(
      null
    );

  const onCloseRef =
    useRef(onClose);

  const dismissibleRef =
    useRef(dismissible);

  const modalInstanceIdRef =
    useRef<symbol>(
      Symbol("modal")
    );

  /*
   * Keep callback refs current without
   * reinstalling the keyboard listener
   * whenever a parent renders.
   */
  useEffect(() => {
    onCloseRef.current =
      onClose;
  }, [onClose]);

  useEffect(() => {
    dismissibleRef.current =
      dismissible;
  }, [dismissible]);

  useEffect(() => {
    if (
      !open ||
      !keyboardAvoiding
    ) {
      setKeyboardHeight(0);
      return;
    }

    let showListener:
      | PluginListenerHandle
      | undefined;

    let hideListener:
      | PluginListenerHandle
      | undefined;

    let disposed = false;

    async function installKeyboardListeners():
      Promise<void> {
      const nextShowListener =
        await Keyboard.addListener(
          "keyboardWillShow",
          (info) => {
            setKeyboardHeight(
              Math.max(
                0,
                info.keyboardHeight
              )
            );
          }
        );

      if (disposed) {
        await nextShowListener.remove();
        return;
      }

      showListener =
        nextShowListener;

      const nextHideListener =
        await Keyboard.addListener(
          "keyboardWillHide",
          () => {
            setKeyboardHeight(0);
          }
        );

      if (disposed) {
        await nextHideListener.remove();
        return;
      }

      hideListener =
        nextHideListener;
    }

    void installKeyboardListeners();

    return () => {
      disposed = true;

      setKeyboardHeight(0);

      if (showListener) {
        void showListener.remove();
      }

      if (hideListener) {
        void hideListener.remove();
      }
    };
  }, [
    keyboardAvoiding,
    open,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const modalId =
      modalInstanceIdRef.current;

    const activeElement =
      document.activeElement;

    previouslyFocusedElement.current =
      activeElement instanceof HTMLElement
        ? activeElement
        : null;

    registerOpenModal(
      modalId
    );

    /*
     * Delay focus very slightly so Framer Motion
     * can mount the dialog before we search for
     * focusable elements.
     */
    const focusTimer =
      window.setTimeout(
        () => {
          const dialog =
            dialogRef.current;

          if (!dialog) {
            return;
          }

          const currentActiveElement =
            document.activeElement;

          /*
           * If something inside the dialog already
           * received focus, leave it there.
           */
          if (
            currentActiveElement instanceof
              HTMLElement &&
            dialog.contains(
              currentActiveElement
            )
          ) {
            return;
          }

          const focusableElements =
            Array.from(
              dialog.querySelectorAll<HTMLElement>(
                FOCUSABLE_ELEMENTS
              )
            ).filter(
              (element) =>
                !element.hasAttribute(
                  "disabled"
                ) &&
                element.getAttribute(
                  "aria-hidden"
                ) !== "true" &&
                element.offsetParent !==
                  null &&
                window.getComputedStyle(
                  element
                ).visibility !==
                  "hidden"
            );

          const firstFocusable =
            focusableElements[0];

          if (firstFocusable) {
            firstFocusable.focus({
              preventScroll: true,
            });
          } else {
            dialog.focus({
              preventScroll: true,
            });
          }
        },
        100
      );

    function handleKeyDown(
      event: KeyboardEvent
    ): void {
      /*
       * When Modal transitions overlap, only
       * the top-most Modal should respond.
       */
      if (
        !isTopModal(
          modalId
        )
      ) {
        return;
      }

      if (
        event.key ===
        "Escape"
      ) {
        if (
          dismissibleRef.current
        ) {
          event.preventDefault();
          event.stopPropagation();

          onCloseRef.current();
        }

        return;
      }

      if (
        event.key !== "Tab"
      ) {
        return;
      }

      const dialog =
        dialogRef.current;

      if (!dialog) {
        return;
      }

      const focusableElements =
        Array.from(
          dialog.querySelectorAll<HTMLElement>(
            FOCUSABLE_ELEMENTS
          )
        ).filter(
          (element) =>
            !element.hasAttribute(
              "disabled"
            ) &&
            element.getAttribute(
              "aria-hidden"
            ) !== "true" &&
            element.offsetParent !==
              null &&
            window.getComputedStyle(
              element
            ).visibility !==
              "hidden"
        );

      if (
        focusableElements.length ===
        0
      ) {
        event.preventDefault();

        dialog.focus({
          preventScroll: true,
        });

        return;
      }

      const firstElement =
        focusableElements[0];

      const lastElement =
        focusableElements[
          focusableElements.length -
            1
        ];

      const activeElement =
        document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement ===
            firstElement ||
          !dialog.contains(
            activeElement
          )
        ) {
          event.preventDefault();

          lastElement.focus({
            preventScroll: true,
          });
        }

        return;
      }

      if (
        activeElement ===
          lastElement ||
        !dialog.contains(
          activeElement
        )
      ) {
        event.preventDefault();

        firstElement.focus({
          preventScroll: true,
        });
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.clearTimeout(
        focusTimer
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      unregisterOpenModal(
        modalId
      );

      const elementToRestore =
        previouslyFocusedElement.current;

      /*
       * Restore focus after React has completed
       * the modal transition/unmount.
       */
      window.setTimeout(
        () => {
          if (
            !elementToRestore ||
            !document.contains(
              elementToRestore
            )
          ) {
            return;
          }

          /*
           * Don't move focus behind another
           * Modal that is still open.
           */
          if (
            openModalStack.length >
            0
          ) {
            const activeDialogs =
              Array.from(
                document.querySelectorAll<HTMLElement>(
                  '[role="dialog"][aria-modal="true"]'
                )
              );

            const belongsToOpenDialog =
              activeDialogs.some(
                (dialog) =>
                  dialog.contains(
                    elementToRestore
                  )
              );

            if (
              !belongsToOpenDialog
            ) {
              return;
            }
          }

          elementToRestore.focus({
            preventScroll: true,
          });
        },
        0
      );
    };
  }, [open]);

  function handleBackdropClick(): void {
    if (
      !dismissible
    ) {
      return;
    }

    if (
      !isTopModal(
        modalInstanceIdRef.current
      )
    ) {
      return;
    }

    onClose();
  }

  const isSheet =
    variant === "sheet";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{
            paddingBottom:
              keyboardAvoiding
                ? keyboardHeight
                : 0,
            transition:
              keyboardAvoiding
                ? "padding-bottom 180ms ease-out"
                : undefined,
          }}
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.2,
          }}
        >
          <motion.button
            type="button"
            aria-label={
              dismissible
                ? "Close dialog"
                : undefined
            }
            tabIndex={-1}
            className={`absolute inset-0 bg-black/70 ${
              dismissible
                ? "cursor-default"
                : "cursor-default"
            }`}
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.2,
            }}
            onClick={
              handleBackdropClick
            }
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              labelledBy
            }
            tabIndex={-1}
            className={
              isSheet
                ? "relative z-10 w-full max-w-[430px] rounded-t-3xl bg-[#282828] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl"
                : "relative z-10 mx-5 w-full max-w-sm rounded-2xl bg-[#282828] p-6 shadow-2xl"
            }
            initial={
              isSheet
                ? {
                    opacity: 0,
                    y: "100%",
                  }
                : {
                    opacity: 0,
                    scale: 0.92,
                    y: 12,
                  }
            }
            animate={
              isSheet
                ? {
                    opacity: 1,
                    y: 0,
                  }
                : {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }
            }
            exit={
              isSheet
                ? {
                    opacity: 0,
                    y: "100%",
                  }
                : {
                    opacity: 0,
                    scale: 0.92,
                    y: 12,
                  }
            }
            transition={
              isSheet
                ? {
                    type: "spring",
                    damping: 30,
                    stiffness: 320,
                  }
                : {
                    duration: 0.2,
                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                  }
            }
            onClick={(
              event
            ) => {
              event.stopPropagation();
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}