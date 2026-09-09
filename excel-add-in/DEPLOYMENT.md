# Deploying the OpenBB Add-in for Excel On-Premise

This documentation section provides guidelines for deploying the OpenBB Excel add-in in an on-premise environment, separated into steps for the OpenBB Add-in Developer and a guide for the Client Organization Administrator.

## Guidelines for OpenBB Add-in Developer

The developer's primary task is to build and deliver the customized add-in package, including the front-end application and the manifest file, configured for the client's domain.

| Step                         | Action                                                        | Details                                                                                              |
| :--------------------------- | :------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------- |
| **1. Configure Environment** | Update local environment variables (e.g., in an `.env` file). | The `ADDIN_BASE_URL` variable must be set to the domain where the client will host the application (e.g., `https://client-domain.com`). This URL is automatically replaced in the `manifest.xml` during the build. |
| **2. Configure Backend URL** | Update the backend URL configuration.                         | The `VITE_BACKEND_URL` must point to the client's specific OpenBB instance/backend. This variable is hardwired into the application bundle at build time, as the add-in uses this to point to the services (e.g., for login). |
| **3. Configure Add-in UUID** | Set a unique identifier for the add-in.                       | The `ADDIN_UUID` variable must be set to a unique UUID for the client's deployment. This identifier is used in the manifest.xml file. |
| **4. Build the Application** | Run the build command to generate the production-ready files. | Execute `npm run build`. This command creates the static bundle and updates the `manifest.xml` in the `dist` folder with the new `ADDIN_BASE_URL` and other configuration variables. |
| **5. Validate Manifest**     | Validate the generated manifest file.                         | Execute `npm run validate` to ensure the manifest.xml file is valid before delivery.                 |
| **6. Package for Delivery**  | Prepare the built files for client transfer.                  | Deliver the contents of the `dist` folder (the build static bundle and the customized `manifest.xml`) to the client, typically as a `.zip` file. |

## Guide for Client Organization Administrator

The OpenBB Excel Add-in is an application that integrates directly into Microsoft Excel, providing users with access to data available in their OpenBB Workspace. It uses a custom ribbon interface and task pane.

From a technical perspective the add-in consists of a static web application bundle and a manifest file that configures how Excel loads and displays the add-in.

The administrator's role is to host the application services and distribute the custom manifest within their Microsoft 365 environment.

**Prerequisites.**

- The client should have the infrastructure to host the OpenBB add-in for Excel application (minified static html/js/css bundle)
- The client should have all necessary backend services (e.g., the OpenBB Workspace application) deployed on their own infrastructure.
- The client should provide 2 URLs to the add-in developer:
  - The URL for the resource where the Add-in will be served from
  - The URL of the OpenBB Workspace backend
- The add-in developer must provide a customized application bundle, including the `manifest.xml` file, configured with the client's hosted domain.

**Deployment Steps.**

1. **Obtain Customized Files:** Receive the customized application files (the built bundle and `manifest.xml`) from the OpenBB team.
2. **Host the Application:** Host the application bundle (the front-end code) on the client's chosen domain. This domain should match the `ADDIN_BASE_URL` configured in the manifest.
3. **Access Admin Center:** Log in to the organization's Microsoft 365 Admin Center.
4. **Navigate to Integrated Apps:** Go to the section for **Integrated Apps** (or equivalent for managing custom add-ins).
5. **Upload Custom App:** Select the option to **Upload Custom App**.
6. **Upload Manifest:** Upload the customized `manifest.xml` file provided by OpenBB.
7. **Deploy to Users:** Follow the prompts to deploy the add-in to the desired user groups or the entire organization.

Once deployed - the custom manifest file instructs the client's Excel application to load the add-in from the client's hosted domain.
