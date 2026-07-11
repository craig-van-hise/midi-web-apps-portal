
# Product Requirements Prompt (PRP) — ✅ Completed

## 1. Project Context & Objectives
The Chord Notator requires a 2MB binary database (`PCS_LUT.dat`) to perform zero-latency, O(1) bitmask-based chord and scale lookups. The current objective is to compile the latest `PCS_LUT.json` database into this binary format using an existing local script and deploy it to the portal's public assets folder.

## 2. Technical Decisions & Dependencies
* **Generator Script:** We will execute the existing Node.js packer script located at `/Users/vv2024/Documents/Repos - vv2024/MIDI/react-midi-components/scripts/pack_lut.js`.
* **Data Format (`PLUT`):** The script packs 4096 entries into a custom binary format containing a 12-byte header, a row offset table, 64-byte fixed row headers, variable length data arrays, and a UTF-8 string pool.
* **Deployment Path:** The resulting `.dat` output will be manually migrated from the `react-midi-components` workspace into the `midi-web-apps-portal/public/` directory.

## 3. Implementation Phases

### Phase 4: Generate and Deploy PCS_LUT.dat — ✅ Completed
* **Objective:** Execute the compilation script and migrate the binary payload to the portal.
* **Instructions:**
  1. Open a terminal and navigate to the components workspace: `cd "/Users/vv2024/Documents/Repos - vv2024/MIDI/react-midi-components"`.
  2. Execute the packer script via Node: `node scripts/pack_lut.js`.
  3. Confirm the terminal outputs a success message indicating 4096 entries were packed into roughly 2,238,316 bytes.
  4. Copy the generated `./public/PCS_LUT.dat` file into the `midi-web-apps-portal/public/` directory, overwriting the previous version.
* **TDD Checkpoint:** * **Test Case 1:** [Given the copy operation is complete, Assert that `PCS_LUT.dat` exists in `midi-web-apps-portal/public/` and its modified timestamp reflects the current time].
  * **Status Update:** "Transition Phase status to 🔵 Active. Execute the script and copy the file. Once verified, update status to ✅ Completed before initiating subsequent phases."
  * **User Verification (If applicable):** "[USER VERIFICATION REQUIRED] Check the browser's Network tab when opening the portal to ensure `PCS_LUT.dat` is successfully fetched with a `200 OK` status."

## 4. Final Review & Validation
* **Technical Audit:** Verify the frontend `DataView` logic does not throw out-of-bounds errors when reading the newly compiled file.
* **Status Reconciliation:** Verify Phase 4 matches ✅ before updating top-level status to ✅.
* **Final Sign-off:** Trigger a MIDI chord while the Chord Notator is active to ensure the new dataset is successfully parsing and displaying chords.