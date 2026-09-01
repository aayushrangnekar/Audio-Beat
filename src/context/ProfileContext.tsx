import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface ProfileContextValue {
  username: string;
  hasCompletedProfileSetup: boolean;
  setUsername: (name: string) => void;
}

const USERNAME_STORAGE_KEY =
  "audio-beat-username";

function loadSavedUsername(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return (
      window.localStorage.getItem(
        USERNAME_STORAGE_KEY
      )?.trim() ?? ""
    );
  } catch (error) {
    console.error(
      "Unable to load saved username:",
      error
    );

    return "";
  }
}

const ProfileContext =
  createContext<ProfileContextValue | null>(
    null
  );

export function ProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [username, setUsernameState] =
    useState<string>(loadSavedUsername);

  const setUsername = useCallback(
    (name: string): void => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return;
      }

      setUsernameState(trimmedName);

      try {
        window.localStorage.setItem(
          USERNAME_STORAGE_KEY,
          trimmedName
        );
      } catch (error) {
        console.error(
          "Unable to save username:",
          error
        );
      }
    },
    []
  );

  const hasCompletedProfileSetup =
    username.trim().length > 0;

  const value =
    useMemo<ProfileContextValue>(
      () => ({
        username,
        hasCompletedProfileSetup,
        setUsername,
      }),
      [
        username,
        hasCompletedProfileSetup,
        setUsername,
      ]
    );

  return (
    <ProfileContext.Provider
      value={value}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile():
  ProfileContextValue {
  const context =
    useContext(ProfileContext);

  if (!context) {
    throw new Error(
      "useProfile must be used within ProfileProvider"
    );
  }

  return context;
}