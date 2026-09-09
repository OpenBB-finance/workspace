import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { inviteUser } from "~/api/admin.api";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import type { TUserForm } from "~/components/AdminUsers/InviteUser/InviteSingleUser";
import { Button } from "~/components/ds/atoms/Button";
import { TabsContent } from "~/components/ds/molecules/Tabs";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import type { CreateUserDTO } from "~/types/user.type";

export default function ImportUsers({
  permissions,
  onClose,
}: {
  permissions: string;
  onClose: () => void;
}) {
  const [usersFileError, setUsersFileError] = useState<string | null>(null);
  const [usersFromFile, setUsersFromFile] = useState<TUserForm[]>([]);
  const usersFileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB max size
    multiple: false,
    onDrop: async (acceptedFiles, rejectedFiles) => {
      setError(null);
      setUsersFromFile([]);
      setFileName(null);

      if (rejectedFiles.length > 0) {
        const sizeError = rejectedFiles.some((file) =>
          file.errors.some((err) => err.code === "file-too-large"),
        );

        if (sizeError) {
          setError("File size must be less than 5MB");
        } else {
          setError("Only CSV files are supported");
        }
        return;
      }

      if (acceptedFiles.length === 0) {
        return;
      }

      const file = acceptedFiles[0];
      parseCSVFile(file).then(() => {
        const input = document.getElementById("upload-import-file") as HTMLInputElement;
        if (input) input.value = null;
      });
    },
  });

  async function inviteMultiple() {
    if (!usersFromFile.length) return;

    setIsUploading(true);
    const queue = usersFromFile.map((user) => {
      const dto: CreateUserDTO = {
        ...user,
        permissions_uuid: permissions,
      };
      return inviteUser(dto);
    });

    try {
      const res = await Promise.all(queue);

      if (res.every((r) => r.success)) {
        toast.success("Users invited", {
          description: `${res.length} user(s) have been invited.`,
        });
        queryClient.invalidateQueries({
          queryKey: ["admin", "users"],
        });
        queryClient.invalidateQueries({
          queryKey: ["admin", "entityInfo"],
        });
        onClose();
        return;
      }

      const errors = res.filter((r) => !r.success);
      const notInvited = usersFromFile.filter((_user, i) => !res[i].success);

      if (errors.length === usersFromFile.length) {
        toast.error("Users not invited", {
          description: "No users have been invited.",
        });
      } else {
        toast.warning("Users partially invited", {
          description: `${res.length - errors.length} user(s) have been invited.
          ${notInvited.map((u) => u.email).join(", ")} are skipped.`,
        });
      }
      onClose();
    } catch (error) {
      if (
        error?.response?.data?.detail === "This email already has an account registered"
      ) {
        setError("Email already has an account registered");
      }
    } finally {
      setIsUploading(false);
    }
  }

  const parseCSVFile = async (file: File) => {
    setFileName(file.name);

    return Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors = results.errors.map((error) => error.code);
        if (!Array.isArray(results.data) && errors.length > 0) {
          setError("Invalid CSV format");
          setUsersFromFile([]);
          return;
        }

        const users = results.data
          .map((row: any) => {
            const { first_name, last_name, email } = row;
            if (!email?.includes("@")) return null;

            return {
              first_name: first_name || "",
              last_name: last_name || "",
              email,
            };
          })
          .filter(Boolean) as TUserForm[];

        if (users.length === 0) {
          setError("No valid users found in the CSV file");
        } else {
          setUsersFromFile(users);
          setError(null);
        }
      },
      error: () => {
        setError("Error parsing CSV file");
        setUsersFromFile([]);
      },
    });
  };

  function renderUsersFileLabel() {
    if (!usersFileRef.current) return null;

    if (!usersFileRef.current.files?.length) {
      return <span className="text-ds-text-caption">No file selected</span>;
    }

    if (usersFileError) {
      return (
        <span className="inline-flex items-center text-alert-error">
          <Icon id="exclamation-outline-triangle" className="inline size-4" />
          <span className="ml-1">{usersFileError}</span>
        </span>
      );
    }

    if (!usersFromFile.length) {
      return <span className="text-alert-warning">No users found</span>;
    }

    return <span>{usersFromFile.length} users found</span>;
  }

  return (
    <TabsContent
      value="import"
      className="flex flex-col gap-4 h-full grow min-h-[460px]"
    >
      <div className="flex items-center gap-1 body-xs-regular">
        Invite users by uploading a CSV file. Download the template below, remove the
        sample data, and add your own. Ensure all mandatory fields are completed before
        uploading.
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const template =
              "first_name,last_name,email\nJohn,Doe,john.doe@example.com";
            const blob = new Blob([template], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "user_invite_template.csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1 text-brand-lighter"
          type="button"
        >
          <Icon id="download" className="size-4" />
          <span>Download sample file</span>
        </button>
        <Tooltip
          message={
            <>
              <p className="body-xs-bold">CSV File</p>
              <p className="body-xs-regular mt-2.5">
                Mandatory fields: first_name,last_name,email
              </p>
            </>
          }
          position="top"
        >
          <button type="button">
            <Icon id="help-outline-circle" className="inline text-ds-text-caption" />
          </button>
        </Tooltip>
      </div>

      {usersFromFile.length ? (
        <div className="space-y-4">
          <div
            className="p-1.5 rounded bg-general-bg-secondary
            flex items-center justify-between gap-1 h-8 w-fit"
          >
            <div className="flex items-center gap-1">
              <Icon id="file-04" className="h-4 min-w-4 text-brand-lighter" />
              <Tooltip
                message={fileName || ""}
                className="max-w-radix-tooltip-content-available-width!"
              >
                <span
                  className="ml-1 mr-3 whitespace-nowrap truncate text-ellipsis
                  overflow-hidden text-ds-text-body"
                >
                  {fileName}
                </span>
              </Tooltip>
            </div>
            <div className="self-end flex gap-2 items-center mb-0.5">
              <Tooltip message="Delete file">
                <div
                  onClick={() => {
                    setUsersFromFile([]);
                    setFileName(null);
                    setError(null);
                  }}
                >
                  <Icon
                    id="x-outline-circle"
                    className="h-4 w-4 cursor-pointer text-ds-text-body"
                  />
                </div>
              </Tooltip>
            </div>
          </div>

          <div className="border border-general-border-secondary rounded overflow-hidden">
            <div
              className="bg-general-bg-secondary p-2
              border-b border-general-border-secondary flex font-medium"
            >
              <div className="w-1/3">First Name</div>
              <div className="w-1/3">Last Name</div>
              <div className="w-1/3">Email</div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {usersFromFile.map((user, index) => (
                <div
                  key={index}
                  className="flex p-2 border-b border-general-border-secondary last:border-0"
                >
                  <div className="w-1/3">{user.first_name}</div>
                  <div className="w-1/3">{user.last_name}</div>
                  <div className="w-1/3">{user.email}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-sm text-ds-text-caption">
            {usersFromFile.length} user{usersFromFile.length > 1 ? "s" : ""} found
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className="h-[198px] w-full rounded flex items-center justify-center flex-col
          border border-dashed border-general-border-secondary
          bg-general-bg-primary cursor-pointer"
        >
          <input
            {...getInputProps()}
            id="upload-import-file"
            data-testid="upload-import-file"
          />
          {isDragActive ? (
            <div className="flex flex-col items-center justify-center">
              <Icon id="download-icon" className="text-ds-text-body w-5 h-5" />
              <p className="text-ds-text-caption">Drop the CSV file here</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <Icon id="upload" className="text-ds-text-body w-5 h-5" />
              <p className="text-ds-text-caption my-2.5">
                <strong>Drag and Drop</strong> CSV file here
              </p>
              <p className="text-ds-text-caption mb-2.5">or</p>
              <Button loading={isUploading} variant="secondary" size="sm">
                Browse for file
              </Button>
              <p className="mt-2.5 text-ds-text-caption text-2xs">
                File size limit: 5MB
              </p>
            </div>
          )}
        </div>
      )}

      {error && <div className="text-alert-error mt-2 text-sm">{error}</div>}

      <AdminDialogFooter
        className="mt-auto"
        primaryButtonName="Invite"
        primaryButtonDisabled={usersFromFile.length === 0 || isUploading}
        onPrimaryButtonClick={inviteMultiple}
        primaryButtonTestId="invite-users-button"
      />
    </TabsContent>
  );
}
