/**
 * Handles async tasks.
 */
export default class AsyncTaskManager {
	private static taskID = 0;
	private runningTasks: { [k: string]: () => void } = {};
	private runningTimers: NodeJS.Timeout[] = [];
	private callbacks: Array<() => void> = [];
	private callbackTimeout: NodeJS.Timeout | null = null;

	/**
	 * Returns a promise that is fulfilled when async tasks are complete.
	 * This method is not part of the HTML standard.
	 *
	 * @returns Promise.
	 */
	public whenComplete(): Promise<void> {
		return new Promise((resolve) => {
			this.callbacks.push(resolve);
			this.endTask(null);
		});
	}

	/**
	 * Ends all tasks.
	 *
	 * @param [error] Error.
	 */
	public cancelAll(): void {
		this.endAll(true);
	}

	/**
	 * Starts a timer.
	 *
	 * @param timerID Timer ID.
	 */
	public startTimer(timerID: NodeJS.Timeout): void {
		this.runningTimers.push(timerID);
		if (this.callbackTimeout) {
			global.clearTimeout(this.callbackTimeout);
			this.callbackTimeout = null;
		}
	}

	/**
	 * Ends a timer.
	 *
	 * @param timerID Timer ID.
	 */
	public endTimer(timerID: NodeJS.Timeout): void {
		const index = this.runningTimers.indexOf(timerID);
		if (index !== -1) {
			this.runningTimers.splice(index, 1);
		}
		if (this.callbackTimeout) {
			global.clearTimeout(this.callbackTimeout);
			this.callbackTimeout = null;
		}
		if (!Object.keys(this.runningTasks).length && !this.runningTimers.length) {
			this.endAll();
		}
	}

	/**
	 * Starts an async task.
	 *
	 * @param abortHandler Abort handler.
	 * @returns Task ID.
	 */
	public startTask(abortHandler?: () => void): number {
		const taskID = this.newTaskID();
		this.runningTasks[taskID] = abortHandler ? abortHandler : () => {};
		if (this.callbackTimeout) {
			global.clearTimeout(this.callbackTimeout);
			this.callbackTimeout = null;
		}
		return taskID;
	}

	/**
	 * Ends an async task.
	 *
	 * @param taskID Task ID.
	 */
	public endTask(taskID: number): void {
		if (this.runningTasks[taskID]) {
			delete this.runningTasks[taskID];
		}
		if (this.callbackTimeout) {
			global.clearTimeout(this.callbackTimeout);
			this.callbackTimeout = null;
		}
		if (!Object.keys(this.runningTasks).length && !this.runningTimers.length) {
			this.endAll();
		}
	}

	/**
	 * Returns the amount of running tasks.
	 *
	 * @returns Count.
	 */
	public getTaskCount(): number {
		return Object.keys(this.runningTasks).length;
	}

	/**
	 * Returns a new task ID.
	 *
	 * @returns Task ID.
	 */
	private newTaskID(): number {
		(<typeof AsyncTaskManager>this.constructor).taskID++;
		return (<typeof AsyncTaskManager>this.constructor).taskID;
	}

	/**
	 * Ends all tasks.
	 *
	 * @param [canceled] Canceled.
	 */
	private endAll(canceled?: boolean): void {
		const runningTimers = this.runningTimers;
		const runningTasks = this.runningTasks;

		this.runningTasks = {};
		this.runningTimers = [];

		for (const timer of runningTimers) {
			global.clearTimeout(timer);
		}

		for (const key of Object.keys(runningTasks)) {
			runningTasks[key]();
		}

		if (this.callbackTimeout) {
			global.clearTimeout(this.callbackTimeout);
			this.callbackTimeout = null;
		}
		if (this.callbacks.length) {
			if (canceled) {
				const callbacks = this.callbacks;
				this.callbacks = [];
				for (const callback of callbacks) {
					callback();
				}
			} else {
				this.callbackTimeout = global.setTimeout(() => {
					const callbacks = this.callbacks;
					this.callbackTimeout = null;
					this.callbacks = [];
					this.runningTimers = [];
					for (const callback of callbacks) {
						callback();
					}
				}, 10);
			}
		}
	}
}
