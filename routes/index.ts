import express, { Router } from 'express';
import userRouter from './userRoutes';
import authRouter from './authRoutes';
import catalogRouter from './catalogRoutes';
import studentRouter from './studentRoutes';
import agentRouter from './agentRoutes';
import adminRouter from './adminRoutes';

interface Route {
  path: string;
  route: Router;
}

const allRoutes = express.Router();

const defaultRoutes: Route[] = [
  {
    path: '/auth',
    route: authRouter,
  },
  {
    path: '/user',
    route: userRouter,
  },
  {
    path: '/catalog',
    route: catalogRouter,
  },
  {
    path: '/student',
    route: studentRouter,
  },
  {
    path: '/agent',
    route: agentRouter,
  },
  {
    path: '/admin',
    route: adminRouter,
  },
];

defaultRoutes.forEach(route => {
  allRoutes.use(route.path, route.route);
});

export default allRoutes;
