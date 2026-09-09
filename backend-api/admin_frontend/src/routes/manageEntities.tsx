import React, { useState, useEffect } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openbb/ui";
import { ManageBase } from "components/managers/Base";
import { EntitySubmitForm } from "components/managers/Entity";
import { EntityRelationshipSubmitForm } from "components/managers/EntityRelationship";
import { EntityTypeSubmitForm } from "components/managers/EntityType";
import { PermissionsMapSubmitForm } from "components/managers/PermissionsMap";
import { UserSearchBar, UserSubmitForm } from "components/managers/User";
import { type AuthStore, useAuthStore } from "utils/auth";
import {
  type Entity,
  type EntityRelationship,
  type EntityType,
  type FullUser,
  type Paginated,
  type PermissionMap,
  getEntities,
  getEntityRelationships,
  getEntityTypes,
  getPermissionMaps,
  getUsers,
} from "utils/requests";

type allowed_tabs =
  | "user"
  | "entity"
  | "entityType"
  | "entityRelationship"
  | "permissionMap";

interface TAB {
  id: allowed_tabs;
  label: string;
}

const TABS: TAB[] = [
  { id: "user", label: "User" },
  { id: "entity", label: "Entity" },
  { id: "entityType", label: "Entity Type" },
  { id: "entityRelationship", label: "Entity Relationship" },
  { id: "permissionMap", label: "Permission Map" },
];

export default function ManageEntities(): JSX.Element {
  const user = useAuthStore((state: AuthStore) => state.user);
  const paginatedDefault = {
    items: [],
    page: 0,
    pages: 0,
    total: 0,
    size: 0,
  };
  const [entityTypes, setEntityTypes] =
    useState<Paginated<EntityType>>(paginatedDefault);
  const [entityRelationships, setEntityRelationships] =
    useState<Paginated<EntityRelationship>>(paginatedDefault);
  const [entities, setEntities] = useState<Paginated<Entity>>(paginatedDefault);
  const [permissionMaps, setPermissionMaps] =
    useState<Paginated<PermissionMap>>(paginatedDefault);
  const [fullUsers, setFullUsers] = useState<Paginated<FullUser>>(paginatedDefault);

  const dataGetter = async <T,>(
    getter: (accessToken: string) => Promise<any>,
  ): Promise<Paginated<T>> => {
    if (user !== null) {
      const data = await getter(user.accessToken);
      if (data.data !== undefined) {
        return data.data;
      }
    }
    return paginatedDefault;
  };

  const retrieveEntityTypes = async (): Promise<void> => {
    const result = await dataGetter<EntityType>(getEntityTypes);
    setEntityTypes(result);
  };

  const retrieveEntities = async (): Promise<void> => {
    const result = await dataGetter<Entity>(getEntities);
    setEntities(result);
  };

  const retrieveRelationships = async (): Promise<void> => {
    const result = await dataGetter<EntityRelationship>(getEntityRelationships);
    setEntityRelationships(result);
  };

  const retrievePermissionMaps = async (): Promise<void> => {
    const result = await dataGetter<PermissionMap>(getPermissionMaps);
    setPermissionMaps(result);
  };

  const retrieveFullUsers = async (email?: string): Promise<void> => {
    if (user !== null) {
      const data = await getUsers(user.accessToken, 50, 1, email);
      if (data.data !== undefined) {
        setFullUsers(data.data);
        return;
      }
    }
    setFullUsers(paginatedDefault);
  };

  useEffect(() => {
    retrieveEntityTypes().catch(console.error);
    retrieveEntities().catch(console.error);
    retrieveRelationships().catch(console.error);
    retrievePermissionMaps().catch(console.error);
    retrieveFullUsers().catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="obb-admin-title">Entity Administration</h1>
        <p className="obb-admin-subtitle">
          Manage users, entities, roles, relationships, and permission maps.
        </p>
      </div>
      <Tabs defaultValue="user">
      <TabsList className="mb-2 flex w-full flex-wrap gap-2 rounded border border-general-border-primary bg-general-bg-secondary p-1">
        {TABS.map((tab) => (
          <TabsTrigger
            value={tab.id}
            key={tab.id}
            className="rounded px-3 py-1 text-xs data-[state=active]:bg-tab-bg-primary data-[state=active]:text-link-color"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {user !== null && (
        <div>
          <TabsContent value="user">
            <ManageBase
              title="User"
              headers={["Name", "Entity"]}
              SubmitForm={UserSubmitForm}
              columns={["email", "permissions.entity.name"]}
              user={user}
              formData={{ permissionMaps }}
              retrieveItems={retrieveFullUsers}
              items={fullUsers}
              SearchBar={UserSearchBar}
            />
          </TabsContent>
          <TabsContent value="entity">
            <ManageBase
              title="Entity"
              headers={["Name", "Code"]}
              columns={["name", "entity_type.code"]}
              SubmitForm={EntitySubmitForm}
              user={user}
              formData={{ entityTypes }}
              retrieveItems={retrieveEntities}
              items={entities}
            />
          </TabsContent>
          <TabsContent value="entityType">
            <ManageBase
              title="Entity Type"
              headers={["Entity Type", "Code", "Active", "Permissions"]}
              SubmitForm={EntityTypeSubmitForm}
              columns={["entity_type", "code", "active", "permission_hierarchy"]}
              user={user}
              retrieveItems={retrieveEntityTypes}
              items={entityTypes}
            />
          </TabsContent>
          <TabsContent value="entityRelationship">
            <ManageBase
              title="Entity Relationship"
              headers={["Parent", "Child"]}
              SubmitForm={EntityRelationshipSubmitForm}
              columns={["parent.name", "child.name"]}
              user={user}
              formData={{ entities }}
              retrieveItems={retrieveRelationships}
              items={entityRelationships}
            />
          </TabsContent>
          <TabsContent value="permissionMap">
            <ManageBase
              title="Permissions Map"
              headers={["Entity", "User Role"]}
              SubmitForm={PermissionsMapSubmitForm}
              columns={["entity.name", "user_permission.name"]}
              user={user}
              formData={{ entities }}
              retrieveItems={retrievePermissionMaps}
              items={permissionMaps}
            />
          </TabsContent>
        </div>
      )}
      </Tabs>
    </div>
  );
}
