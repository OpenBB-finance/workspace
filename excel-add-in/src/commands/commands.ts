import { getGlobal } from "~/utils/excel";
import "./common.commands";
import "./excel.commands";

Office.onReady(() => {
  // If needed, Office.js is ready to be called
});

/**
 * Shows a notification when the add-in command is executed.
 * @param event
 */
function action(event: Office.AddinCommands.Event) {
  const message: Office.NotificationMessageDetails = {
    type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
    message: "Performed action.",
    icon: "Icon.80x80",
    persistent: true,
  };

  // Show a notification message
  Office.context.mailbox?.item?.notificationMessages.replaceAsync(
    "action",
    message,
  );

  // Be sure to indicate when the add-in command function is complete
  event.completed();
}

// The add-in command functions need to be available in global scope
const g = getGlobal();
if (g) g.action = action;
