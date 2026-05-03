import { Request, Response } from 'express';
import constant from '../constant';
import { catchAsyncError } from '../middleware/catchAsyncError';
import userService from '../services/user.service';

export const myProfile = catchAsyncError(async (req: Request, res: Response) => {
  const user = req.user;

  // user.profilePhoto = user?.profilePhoto
  //   ? await getSignedUrl(`uploads/profile/${user.profilePhoto}`)
  //   : null;
  // Send the response
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: constant.msg.profileFetch,
    user,
  });
});

export const updateProfile = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req?.user;
  const updates = req.body;
  const profilePhoto = req.file;

  const updatedUser = await userService.updateProfileService(user?.id as string, updates, profilePhoto);

  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: constant.msg.profileUpdate,
    user: updatedUser,
  });
});

export const deleteMyAccount = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  await userService.deleteAccountById(user.id as string);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Your account has been deleted',
  });
});
