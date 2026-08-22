import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type AppAlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AppAlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  cancelable: boolean;
};

type Presenter = (request: AppAlertRequest) => void;

/**
 * Set while `AlertHost` is mounted. Kept at module scope so plain helpers can
 * raise an alert too — the chat safety menu is not a component and cannot
 * reach a hook.
 */
let presenter: Presenter | null = null;
let nextRequestId = 1;

/**
 * Drop-in replacement for `Alert.alert`. Same argument shape, so call sites
 * only swap the identifier, but it renders the app's own dark card instead of
 * the OS dialog, which arrives in the system light theme on Android.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: { cancelable?: boolean },
): void {
  const request: AppAlertRequest = {
    id: nextRequestId++,
    title,
    message,
    buttons,
    cancelable: options?.cancelable !== false,
  };

  if (!presenter) {
    // Before the host mounts there is still nothing to render into, and a
    // swallowed message is worse than an out-of-theme one.
    Alert.alert(title, message, buttons, options);
    return;
  }

  presenter(request);
}

const DISMISS_BUTTON: AppAlertButton = { text: 'Понятно' };

export const AlertHost: React.FC = () => {
  const [queue, setQueue] = useState<AppAlertRequest[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    presenter = (request) => setQueue((pending) => [...pending, request]);
    return () => {
      presenter = null;
    };
  }, []);

  const dismissedRef = useRef<number | null>(null);

  // A handler may raise the next alert (blocking a user asks twice), so removal
  // goes by identity rather than position, and a second tap landing before the
  // re-render is ignored instead of discarding whatever came after it.
  const dismiss = useCallback((request: AppAlertRequest, button?: AppAlertButton) => {
    if (dismissedRef.current === request.id) {
      return;
    }
    dismissedRef.current = request.id;
    setQueue((pending) => pending.filter((pendingRequest) => pendingRequest.id !== request.id));
    button?.onPress?.();
  }, []);

  if (!current) {
    return null;
  }

  const buttons = current.buttons?.length ? current.buttons : [DISMISS_BUTTON];
  const cancelButton = buttons.find((button) => button.style === 'cancel');
  // Two buttons read as a question and fit side by side; more than that turns
  // into a menu, and a row of narrow chips is where labels start truncating.
  const stacked = buttons.length > 2;

  const onBackdrop = () => {
    if (!current.cancelable) {
      return;
    }
    dismiss(current, cancelButton);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onBackdrop}>
      <Pressable style={styles.backdrop} onPress={onBackdrop}>
        {/* Swallows taps so pressing the card itself never dismisses it. */}
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';

              return (
                <TouchableOpacity
                  key={`${button.text}-${index}`}
                  style={[
                    styles.button,
                    isCancel ? styles.buttonCancel : styles.buttonPrimary,
                    isDestructive && styles.buttonDestructive,
                    stacked && styles.buttonStacked,
                  ]}
                  onPress={() => dismiss(current, button)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel ? styles.buttonTextCancel : styles.buttonTextPrimary,
                      isDestructive && styles.buttonTextDestructive,
                    ]}
                    numberOfLines={1}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111113',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
  },
  title: {
    color: '#F4F4F5',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  message: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  actionsStacked: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStacked: {
    paddingVertical: 15,
  },
  buttonPrimary: {
    backgroundColor: '#F97316',
  },
  buttonCancel: {
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#18181B',
  },
  buttonDestructive: {
    backgroundColor: '#3F1518',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '900',
  },
  buttonTextPrimary: {
    color: '#09090B',
  },
  buttonTextCancel: {
    color: '#F4F4F5',
    fontWeight: '800',
  },
  buttonTextDestructive: {
    color: '#FCA5A5',
  },
});
