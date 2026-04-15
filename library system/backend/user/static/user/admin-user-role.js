(function () {
  const staffRoles = new Set(['LIBRARIAN', 'STAFF', 'TEACHER']);
  const studentRoles = new Set(['STUDENT', 'WORKING']);

  const roleSelect = document.getElementById('id_role');
  const studentInput = document.getElementById('id_student_id');
  const staffInput = document.getElementById('id_staff_id');

  const getRow = (input) => {
    if (!input) return null;
    return (
      input.closest('.form-row') ||
      input.closest('.form-group') ||
      input.closest('.fieldBox') ||
      input.parentElement
    );
  };

  const studentRow = getRow(studentInput);
  const staffRow = getRow(staffInput);

  const studentLabel = document.querySelector('label[for="id_student_id"]');
  const staffLabel = document.querySelector('label[for="id_staff_id"]');

  const setRowVisible = (row, visible) => {
    if (!row) return;
    row.style.display = visible ? '' : 'none';
  };

  const applyRole = () => {
    if (!roleSelect) return;
    const role = roleSelect.value;
    const isStaffRole = staffRoles.has(role);
    const isStudentRole = studentRoles.has(role);

    if (isStaffRole) {
      setRowVisible(studentRow, false);
      setRowVisible(staffRow, true);
      if (studentInput) studentInput.required = false;
      if (staffInput) staffInput.required = true;
    } else if (isStudentRole) {
      setRowVisible(studentRow, true);
      setRowVisible(staffRow, false);
      if (studentInput) studentInput.required = true;
      if (staffInput) staffInput.required = false;
    } else {
      // Admin or unknown role: show both, no requirement.
      setRowVisible(studentRow, true);
      setRowVisible(staffRow, true);
      if (studentInput) studentInput.required = false;
      if (staffInput) staffInput.required = false;
    }

    if (studentLabel) studentLabel.textContent = 'Student ID';
    if (staffLabel) staffLabel.textContent = 'Faculty ID';
  };

  const init = () => {
    if (!roleSelect) return;
    applyRole();
    roleSelect.addEventListener('change', applyRole);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
