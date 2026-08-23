window.BudgetToolkit = window.BudgetToolkit || {};

window.BudgetToolkit.renderTotals = function renderTotals(container, budgetDetail) {
  const {
    getCustomTotals,
    saveCustomTotals,
    computeTotalForSelections,
    buildCategoryIndex,
    centsToDollars,
  } = window.BudgetToolkit;

  let editingId = null;

  function renderList(customTotals) {
    const list = document.createElement("div");
    list.className = "budget-toolkit-totals-list";

    customTotals.forEach((total) => {
      const { budgetedCents, spentCents, missing } = computeTotalForSelections(
        budgetDetail,
        total.selections
      );

      const row = document.createElement("div");
      row.className = "budget-toolkit-total-row";

      const name = document.createElement("span");
      name.className = "budget-toolkit-total-name";
      name.textContent = total.name;

      const amounts = document.createElement("span");
      amounts.className = "budget-toolkit-total-amounts";
      amounts.textContent = `Budgeted ${centsToDollars(budgetedCents)} · Spent ${centsToDollars(spentCents)}`;
      if (missing.length > 0) {
        amounts.title = `${missing.length} selected categor${missing.length === 1 ? "y" : "ies"} not found in this month's budget`;
      }

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => {
        editingId = total.id;
        rerender(customTotals);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        const next = customTotals.filter((t) => t.id !== total.id);
        await saveCustomTotals(next);
        rerender(next);
      });

      row.append(name, amounts, editButton, deleteButton);
      list.appendChild(row);
    });

    return list;
  }

  function renderForm(customTotals) {
    const editing = customTotals.find((t) => t.id === editingId) || null;

    const form = document.createElement("form");
    form.className = "budget-toolkit-total-form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Total name";
    nameInput.value = editing ? editing.name : "";
    form.appendChild(nameInput);

    const checklist = document.createElement("div");
    checklist.className = "budget-toolkit-checklist";

    const selectedGroups = new Set(
      editing
        ? editing.selections.filter((s) => s.type === "group").map((s) => s.groupLabel)
        : []
    );
    const selectedItems = new Set(
      editing
        ? editing.selections
            .filter((s) => s.type === "item")
            .map((s) => `${s.groupLabel}::${s.itemLabel}`)
        : []
    );

    buildCategoryIndex(budgetDetail).forEach(({ groupLabel, items }) => {
      const groupLabelEl = document.createElement("label");
      const groupCheckbox = document.createElement("input");
      groupCheckbox.type = "checkbox";
      groupCheckbox.dataset.type = "group";
      groupCheckbox.dataset.groupLabel = groupLabel;
      groupCheckbox.checked = selectedGroups.has(groupLabel);
      groupLabelEl.append(groupCheckbox, ` ${groupLabel} (whole group)`);
      checklist.appendChild(groupLabelEl);

      items.forEach((itemLabel) => {
        const itemLabelEl = document.createElement("label");
        itemLabelEl.className = "budget-toolkit-checklist-item";
        const itemCheckbox = document.createElement("input");
        itemCheckbox.type = "checkbox";
        itemCheckbox.dataset.type = "item";
        itemCheckbox.dataset.groupLabel = groupLabel;
        itemCheckbox.dataset.itemLabel = itemLabel;
        itemCheckbox.checked = selectedItems.has(`${groupLabel}::${itemLabel}`);
        itemLabelEl.append(itemCheckbox, ` ${itemLabel}`);
        checklist.appendChild(itemLabelEl);
      });
    });

    form.appendChild(checklist);

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.textContent = editing ? "Save changes" : "Create total";
    form.appendChild(saveButton);

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
      editingId = null;
      rerender(customTotals);
    });
    form.appendChild(cancelButton);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const checked = Array.from(checklist.querySelectorAll("input[type=checkbox]:checked"));
      const selections = checked.map((checkbox) =>
        checkbox.dataset.type === "group"
          ? { type: "group", groupLabel: checkbox.dataset.groupLabel }
          : {
              type: "item",
              groupLabel: checkbox.dataset.groupLabel,
              itemLabel: checkbox.dataset.itemLabel,
            }
      );

      if (!nameInput.value.trim() || selections.length === 0) return;

      const next = editing
        ? customTotals.map((t) =>
            t.id === editing.id ? { ...t, name: nameInput.value.trim(), selections } : t
          )
        : [...customTotals, { id: crypto.randomUUID(), name: nameInput.value.trim(), selections }];

      editingId = null;
      await saveCustomTotals(next);
      rerender(next);
    });

    return form;
  }

  function rerender(customTotals) {
    container.innerHTML = "";
    container.appendChild(renderList(customTotals));

    if (editingId !== null) {
      container.appendChild(renderForm(customTotals));
      return;
    }

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "budget-toolkit-add-total";
    addButton.textContent = "+ New Total";
    addButton.addEventListener("click", () => {
      editingId = "new";
      rerender(customTotals);
    });
    container.appendChild(addButton);
  }

  getCustomTotals().then(rerender);
};
