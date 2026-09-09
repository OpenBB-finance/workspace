"""Endpoints hit at regularly frequencies to run jobs"""

from fastapi import APIRouter, Depends

from api import auth_helpers, worker_tasks
from utilities import workers_queue

router = APIRouter(prefix="/run-tasks", tags=["run_tasks"])


@router.get("/pat-token-check")
async def pat_token_check(_=Depends(auth_helpers.check_lambda)):
    await workers_queue.worker_queue(worker_tasks.pat_token_check, "pat_token_check")
    return 200


@router.get("/give-pro-trial-extension")
async def give_pro_trial_extension(_=Depends(auth_helpers.check_lambda)):
    await workers_queue.worker_queue(
        worker_tasks.give_pro_trial_extension, "give_pro_trial_extension"
    )
    return 200


@router.get("/send-four-day-no-use")
async def send_four_day_no_use(_=Depends(auth_helpers.check_lambda)):
    await workers_queue.worker_queue(worker_tasks.four_days_no_use, "four_days_no_use")
    return 200


@router.get("/delete-old-saves")
async def delete_old_saves(_=Depends(auth_helpers.check_lambda)):
    await workers_queue.worker_queue(worker_tasks.delete_old_saves, "delete_old_saves")
    return 200
