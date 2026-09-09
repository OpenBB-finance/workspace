import { BaseDialog, Button, DialogTitle, useForm } from "@openbb/ui";
import { clsx } from "clsx";
import React, { useState } from "react";
import type { Paginated, User } from "utils/requests";

interface TableBodyProps<T> {
  items: T[];
  columns: string[];
  setShow: (set: boolean) => void;
  setItem: (set: T) => void;
}

export interface SubmitFormProps<T, V> {
  user: User;
  setShowAdd: (set: boolean) => void;
  item?: T;
  setItem: (set: T) => void;
  retrieveItems: () => Promise<void>;
  data: V;
  editType: string;
}

interface ManageBaseProps<T> {
  user: User;
  headers: string[];
  title: string;
  SubmitForm: any;
  columns: string[];
  formData?: Record<string, Paginated<any>>;
  retrieveItems: () => Promise<void>;
  items: Paginated<T>;
  SearchBar?: any;
}

interface TableHeaderProps {
  headers: string[];
}

function TableHeader({ headers }: TableHeaderProps): JSX.Element {
  return (
    <thead>
      <tr className="border-b border-surface-divider bg-general-bg-secondary">
        {headers.map((header, index) => (
          <th
            className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ds-text-subtitle"
            key={index}
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TableBody<T>({
  items,
  columns,
  setItem,
  setShow,
}: TableBodyProps<T>): JSX.Element {
  if (items !== undefined && items.length < 1) {
    return <></>;
  }

  function handleEdit(row: T) {
    setItem(row);
    setShow(true);
  }

  function getValue(row: T, column: string): string | number {
    let value: any = row;
    for (const key of column.split(".")) {
      if (typeof value === "object" && value !== null && key in value) {
        value = value[key];
      }
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    return value;
  }

  return (
    <tbody>
      {items.map((row: T, i: number) => {
        return (
          <tr className="cursor-pointer border-b border-surface-divider bg-general-bg-primary hover:bg-general-bg-primary-hover" onClick={() => handleEdit(row)} key={i}>
            {columns.map((column: string, i: number) => {
              const value = getValue(row, column);
              return (
                <td className="px-5 py-3 text-xs text-ds-text-body" key={i}>
                  {value ?? "-"}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
}

export function ManageBase<T>({
  user,
  headers,
  title,
  SubmitForm,
  columns,
  formData,
  retrieveItems,
  items,
  SearchBar,
}: ManageBaseProps<T>): JSX.Element {
  const [show, setShow] = useState(false);
  const [item, setItem] = useState<undefined | T>();
  const editType = item ? "Edit" : "Add";

  const prepareAdd = (show: boolean): void => {
    setItem(undefined);
    setShow(show);
  };

  const cleanFormData: any = {};
  if (formData !== null && formData !== undefined) {
    for (const [key, value] of Object.entries(formData)) {
      cleanFormData[key] = value.items;
    }
  }

  return (
    <div className="obb-card overflow-hidden">
      {show && (
        <BaseDialog open={show} onClose={() => prepareAdd(false)}>
          <DialogTitle>{`${title} ${editType}`}</DialogTitle>
          <SubmitForm
            user={user}
            setShowAdd={setShow}
            retrieveItems={retrieveItems}
            data={cleanFormData}
            setItem={setItem}
            item={item}
            editType={editType}
          />
        </BaseDialog>
      )}
      <div
        className={clsx("obb-card-header flex items-center gap-2", {
          "justify-end": SearchBar === undefined,
          "justify-between": SearchBar !== undefined,
        })}
      >
        {SearchBar !== undefined && <SearchBar retrieveItems={retrieveItems} />}
        <Button className="obb-btn-blue" onClick={() => prepareAdd(true)}>
          Add
        </Button>
      </div>
      <div className="obb-card-content">
        <table className="w-full overflow-hidden rounded border border-general-border-primary">
          <TableHeader headers={headers} />
          <TableBody
            items={items.items}
            columns={columns}
            setShow={setShow}
            setItem={setItem}
          />
        </table>
        {items.items.length === 0 && (
          <div className="py-6 text-center text-xs text-ds-text-subtitle">
            No {title.toLowerCase()} records found.
          </div>
        )}
      </div>
    </div>
  );
}
