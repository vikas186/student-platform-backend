import { Router } from 'express';
import { myProfile, updateProfile, deleteMyAccount } from '../controller/userController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { upload } from '../middleware/multer';

const userRouter: Router = Router();

userRouter
  .get('/my-profile', jwtAuthMiddleware(['all']), myProfile)
  .patch('/update-profile', jwtAuthMiddleware(['all']), upload.single('profilePhoto'), updateProfile)
  .delete('/account', jwtAuthMiddleware(['all']), deleteMyAccount);

export default userRouter;
