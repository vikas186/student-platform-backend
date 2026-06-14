import { patchStudentCounsellingForAdmin } from '../../../services/adminPortal.service';

/** Mark student counselling complete (shared by admin PATCH and scheduling completion). */
export const markCounsellingCompleted = async (studentProfileId: number): Promise<void> => {
  await patchStudentCounsellingForAdmin(studentProfileId, true);
};

export const clearCounsellingCompleted = async (studentProfileId: number): Promise<void> => {
  await patchStudentCounsellingForAdmin(studentProfileId, false);
};
