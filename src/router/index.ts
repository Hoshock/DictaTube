import { createRouter, createWebHistory } from "vue-router"

import type * as HomeViewModule from "../views/home-view.vue"
import type * as ImportViewModule from "../views/import-view.vue"
import type * as PlayerViewModule from "../views/player-view.vue"

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: (): Promise<typeof HomeViewModule> => import("../views/home-view.vue"),
    },
    {
      path: "/import",
      name: "import",
      component: (): Promise<typeof ImportViewModule> => import("../views/import-view.vue"),
    },
    {
      path: "/videos/:videoId",
      name: "player",
      component: (): Promise<typeof PlayerViewModule> => import("../views/player-view.vue"),
      props: true,
    },
  ],
})
