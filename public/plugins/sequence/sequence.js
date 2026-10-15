//#region \0reline-host:reze-js/internal/reactivity
var e = globalThis.__RELINE__?.["reze-js/internal/reactivity"];
if (e === void 0) throw Error("Reline host not found: this plugin must be loaded by Reline");
e.action, e.beginContinuation;
var t = e.computed;
e.resource;
var n = e.signal;
e.withResourceSite;
//#endregion
//#region \0reline-host:reze-js/internal/runtime
var r = globalThis.__RELINE__?.["reze-js/internal/runtime"];
if (r === void 0) throw Error("Reline host not found: this plugin must be loaded by Reline");
r.ContextNotFoundError, r.action, r.addEventListener;
var i = r.append;
r.asyncComponent, r.asyncComputed, r.asyncViews, r.boundary;
var a = r.branch;
r.catchError, r.child, r.choose, r.className, r.computed;
var o = r.createComponent;
r.createContext, r.createSignalFrame, r.createUniqueId;
var s = r.delegateEvents;
r.dynamic, r.dynamicElement;
var c = r.effect;
r.effectScope, r.element, r.elementMathML, r.elementSVG, r.fixedRenderEffect, r.flush, r.getOwner, r.head, r.hotComponent;
var l = r.insert;
r.isInBoundary, r.island;
var u = r.list;
r.mergeProps, r.next, r.omitProps, r.onCleanup, r.portal, r.profileComponent, r.profileCreated, r.profileDisposed, r.profileHook, r.profileReran, r.profileWrote, r.provideContext, r.readonly, r.reconcileArrays, r.render;
var d = r.renderEffect;
r.repeat, r.root, r.runWithOwner, r.runWithSignalFrame, r.selector;
var f = r.setAttribute;
r.setAttributeNS, r.setBoolAttribute, r.setProfileHook, r.signal, r.splitProps, r.spread, r.startProfileSession, r.stopProfileSession;
var p = r.store;
r.style, r.submitProfileSession;
var m = r.template;
r.templateMathML, r.templateSVG, r.templateWithTextNodes, r.toggleClass, r.trigger;
var h = r.untrack, g = r.use;
r.useContext, r.withReloadScope;
//#endregion
//#region sdk/index.ts
var _ = (e) => e, v = "state", y = {
	en: {
		tab: "Sequence",
		empty: "No steps yet. Add the current stack, or import config files.",
		addCurrent: "Add current stack",
		importFiles: "Import configs…",
		stopOnError: "Stop at the first failure",
		run: "Run sequence",
		stop: "Stop",
		stepOf: "Step {n} of {total}: {name}",
		nodes: "{count} nodes",
		errors: "{count} errors",
		enable: "Include {name} in the sequence",
		name: "Step name",
		up: "Move up",
		down: "Move down",
		load: "Load into the editor",
		update: "Replace with the current stack",
		remove: "Remove step",
		status: {
			pending: "waiting",
			running: "running",
			ok: "done",
			failed: "failed",
			cancelled: "stopped"
		},
		invalid: "The config is invalid: {detail}",
		badFile: "{file}: {detail}",
		stepName: "Step {n}",
		badge: "Sequence {done}/{total}",
		done: "Sequence finished: {ok} of {total} steps done",
		nothing: "Nothing to run: no step is switched on"
	},
	ru: {
		tab: "Последовательность",
		empty: "Шагов пока нет. Добавьте текущий стек или импортируйте файлы конфигов.",
		addCurrent: "Добавить текущий стек",
		importFiles: "Импорт конфигов…",
		stopOnError: "Остановиться на первой ошибке",
		run: "Запустить по очереди",
		stop: "Стоп",
		stepOf: "Шаг {n} из {total}: {name}",
		nodes: "нод: {count}",
		errors: "ошибок: {count}",
		enable: "Включить {name} в последовательность",
		name: "Название шага",
		up: "Выше",
		down: "Ниже",
		load: "Загрузить в редактор",
		update: "Заменить текущим стеком",
		remove: "Убрать шаг",
		status: {
			pending: "ждёт",
			running: "идёт",
			ok: "готово",
			failed: "ошибка",
			cancelled: "остановлен"
		},
		invalid: "Конфиг некорректен: {detail}",
		badFile: "{file}: {detail}",
		stepName: "Шаг {n}",
		badge: "Последовательность {done}/{total}",
		done: "Последовательность завершена: готово шагов — {ok} из {total}",
		nothing: "Запускать нечего: ни один шаг не включён"
	}
}, b = (e, t = "") => Object.entries(e).reduce((e, [n, r]) => {
	let i = t === "" ? n : `${t}.${n}`;
	return typeof r == "string" ? {
		...e,
		[i]: r
	} : {
		...e,
		...b(r, i)
	};
}, {}), x = "\n.rsq { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }\n.rsq-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }\n.rsq-list { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }\n.rsq-step { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; padding: var(--space-2) var(--space-3); background: var(--color-surface-strong); border: 1px solid var(--color-border); border-radius: var(--radius-md); }\n.rsq-step[data-status=\"running\"] { border-color: var(--color-primary); }\n.rsq-step[data-status=\"ok\"] { border-color: color-mix(in srgb, var(--color-success) 55%, var(--color-border)); }\n.rsq-step[data-status=\"failed\"] { border-color: var(--color-danger); }\n.rsq-step[data-off] { opacity: .55; }\n.rsq-head, .rsq-tools { display: flex; align-items: center; min-width: 0; gap: var(--space-2); }\n.rsq-head > .rsq-name { flex: 1; }\n.rsq-tools { flex-wrap: wrap; row-gap: var(--space-2); }\n.rsq-buttons { display: flex; flex: none; gap: var(--space-1); margin-left: auto; }\n.rsq-status { flex: none; color: var(--color-text-muted); font-size: var(--font-size-sm); }\n.rsq-step[data-status=\"failed\"] .rsq-status { color: var(--color-danger); }\n.rsq-meta { flex: none; margin: 0; white-space: nowrap; color: var(--color-text-muted); font-size: var(--font-size-sm); }\n.rsq-meta[data-bad] { color: var(--color-danger); }\n.rsq-note, .rsq-err { margin: 0; color: var(--color-danger); font-size: var(--font-size-sm); overflow-wrap: anywhere; }\n.rsq-muted, .rsq-progress { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }\n.rsq-badge { display: inline-flex; align-items: center; height: 24px; padding: 0 var(--space-2); color: var(--color-text); font-size: var(--font-size-sm); background: color-mix(in srgb, var(--color-primary) 40%, transparent); border-radius: var(--radius-sm); white-space: nowrap; }\n", S = _({ activate(e) {
	e.i18n.add("en", b(y.en)), e.i18n.add("ru", b(y.ru)), e.ui.styles(x);
	let { Button: r, IconButton: s, Input: _, Icon: S } = e.ui.kit, C = e.ui.kit.Switch, w = (t, n) => e.i18n.t(t, n), T = p((() => {
		let t = e.storage.getJson(v);
		return {
			steps: (Array.isArray(t?.steps) ? t.steps : []).map((e) => ({
				...e,
				status: e.status === "running" ? "pending" : e.status
			})),
			stopOnError: t?.stopOnError ?? !0
		};
	})()), [E, D] = n(""), [O, k] = n(!1), [A, j] = n({
		at: 0,
		total: 0,
		name: ""
	}), M = !1, [N, P] = n(0), F = (e) => {
		e(T), P(N() + 1);
	};
	c(() => {
		N(), h(() => e.storage.set(v, JSON.stringify(T)));
	});
	let I = (e) => T.steps.findIndex((t) => t.id === e), L = (e, t) => F((n) => {
		let r = n.steps.findIndex((t) => t.id === e);
		r !== -1 && Object.assign(n.steps[r], t);
	}), R = () => typeof crypto < "u" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, z = () => JSON.parse(JSON.stringify(e.config.toPure(e.store.nodes()))), B = (e, t) => F((n) => {
		n.steps.push({
			id: R(),
			name: e,
			enabled: !0,
			config: t,
			status: "pending",
			note: ""
		});
	}), V = () => {
		D(""), B(w("stepName", { n: T.steps.length + 1 }), z());
	}, H = async (t) => {
		D("");
		for (let n of Array.from(t)) try {
			let t = e.config.parse(await n.text()), r = JSON.parse(JSON.stringify(e.config.toPure(t)));
			B(n.name.replace(/\.json$/i, ""), r);
		} catch (e) {
			D(() => w("badFile", {
				file: n.name,
				detail: e instanceof Error ? e.message : String(e)
			}));
		}
	}, U = (e, t) => F((n) => {
		let r = n.steps.findIndex((t) => t.id === e), i = r + t;
		if (r === -1 || i < 0 || i >= n.steps.length) return;
		let [a] = n.steps.splice(r, 1);
		n.steps.splice(i, 0, a);
	}), W = (e) => F((t) => {
		t.steps = t.steps.filter((t) => t.id !== e);
	}), G = (t) => {
		let n = T.steps[I(t)];
		if (n !== void 0) {
			D("");
			try {
				e.config.replaceStack(e.config.fromPure(n.config));
			} catch (e) {
				D(() => w("invalid", { detail: e instanceof Error ? e.message : String(e) }));
			}
		}
	}, K = async () => {
		if (O()) return;
		let t = T.steps.filter((e) => e.enabled).map((e) => e.id);
		if (t.length === 0) {
			D(() => w("nothing"));
			return;
		}
		D(""), M = !1, k(!0);
		for (let e of t) L(e, {
			status: "pending",
			note: ""
		});
		let n = 0;
		try {
			for (let [r, i] of t.entries()) {
				if (M) break;
				let a = T.steps[I(i)];
				if (a === void 0) continue;
				j({
					at: r + 1,
					total: t.length,
					name: a.name
				}), L(i, { status: "running" });
				let o;
				try {
					let t = e.config.analyze(e.config.fromPure(a.config));
					if (t.errors > 0) {
						let e = t.diagnostics.find((e) => e.severity === "error");
						throw Error(e === void 0 ? "invalid" : w("errors", { count: t.errors }));
					}
					o = t.config;
				} catch (e) {
					if (L(i, {
						status: "failed",
						note: w("invalid", { detail: e instanceof Error ? e.message : String(e) })
					}), T.stopOnError) break;
					continue;
				}
				try {
					let t = await e.run.start(o);
					if (t.cancelled) {
						L(i, { status: "cancelled" });
						break;
					}
					if (t.ok) n += 1, L(i, { status: "ok" });
					else if (L(i, {
						status: "failed",
						note: e.i18n.t("status.failed")
					}), T.stopOnError) break;
				} catch (e) {
					L(i, {
						status: "failed",
						note: e instanceof Error ? e.message : String(e)
					});
					break;
				}
			}
		} finally {
			k(!1), D(() => w("done", {
				ok: n,
				total: t.length
			}));
		}
	}, q = () => {
		M = !0, e.run.stop();
	}, J = (t) => {
		try {
			let n = e.config.analyze(e.config.fromPure(t));
			return {
				nodes: t.nodes.length,
				errors: n.errors
			};
		} catch {
			return {
				nodes: t.nodes.length,
				errors: 1
			};
		}
	}, Y = (e) => {
		let n = t(() => J(e.step.config));
		{
			let r = m("<li class=rsq-step><div class=rsq-head><span class=rsq-status></span></div><div class=rsq-tools><p class=rsq-meta></p><div class=rsq-buttons>"), a = r.firstChild, c = a.firstChild, u = a.nextSibling.firstChild, p = u.nextSibling;
			return l(a, o(C, {
				get checked() {
					return e.step.enabled;
				},
				onChange: (t) => L(e.step.id, { enabled: t }),
				get ariaLabel() {
					return w("enable", { name: e.step.name });
				}
			}), c), l(a, o(_, {
				class: "rsq-name",
				get value() {
					return e.step.name;
				},
				get "aria-label"() {
					return w("name");
				},
				get disabled() {
					return O();
				},
				onInput: (t) => L(e.step.id, { name: t.currentTarget.value })
			}), c), l(c, () => w(`status.${e.step.status}`)), i(u, () => w("nodes", { count: n().nodes })), i(u, (() => {
				let e = t(() => n().errors > 0);
				return () => e() ? [" · ", () => w("errors", { count: n().errors })] : !1;
			})()), i(p, o(s, {
				icon: "arrow-up",
				get label() {
					return w("up");
				},
				get disabled() {
					return O() || e.index === 0;
				},
				onClick: () => U(e.step.id, -1)
			})), i(p, o(s, {
				icon: "arrow-down",
				get label() {
					return w("down");
				},
				get disabled() {
					return O() || e.index === T.steps.length - 1;
				},
				onClick: () => U(e.step.id, 1)
			})), i(p, o(s, {
				icon: "pencil",
				get label() {
					return w("load");
				},
				get disabled() {
					return O();
				},
				onClick: () => G(e.step.id)
			})), i(p, o(s, {
				icon: "refresh",
				get label() {
					return w("update");
				},
				get disabled() {
					return O();
				},
				onClick: () => L(e.step.id, { config: z() })
			})), i(p, o(s, {
				icon: "trash",
				get label() {
					return w("remove");
				},
				get disabled() {
					return O();
				},
				onClick: () => W(e.step.id)
			})), i(r, (() => {
				let n = t(() => e.step.note !== "");
				return () => n() ? (() => {
					let t = m("<p class=rsq-note>");
					return l(t, () => e.step.note), t;
				})() : !1;
			})()), d(() => {
				let t = e.step.status;
				f(r, "data-status", t);
			}), d(() => {
				let t = e.step.enabled ? void 0 : "";
				f(r, "data-off", t);
			}), d(() => {
				let e = n().errors > 0 ? "" : void 0;
				f(u, "data-bad", e);
			}), r;
		}
	};
	e.ui.panelTab({
		id: "sequence",
		label: e.i18n.text("tab"),
		Component: () => {
			let e;
			{
				let n = m("<div class=rsq><div class=rsq-actions><input type=file accept=.json,application/json multiple hidden></div><div class=rsq-actions>"), s = n.firstChild, c = s.firstChild, d = s.nextSibling;
				return typeof e == "function" ? g(e, c) : e = c, c.$$input = (e) => {
					let t = e.currentTarget.files;
					t !== null && t.length > 0 && H(t), e.currentTarget.value = "";
				}, l(s, o(r, {
					get disabled() {
						return O();
					},
					onClick: V,
					get children() {
						return [o(S, {
							name: "plus",
							size: 14
						}), () => w("addCurrent")];
					}
				}), c), l(s, o(r, {
					get disabled() {
						return O();
					},
					onClick: () => e?.click(),
					get children() {
						return [o(S, {
							name: "upload",
							size: 14
						}), () => w("importFiles")];
					}
				}), c), l(n, a(() => T.steps.length > 0, () => (() => {
					let e = m("<ul class=rsq-list>");
					return l(e, u(() => T.steps, (e, t) => o(Y, {
						step: e,
						get index() {
							return t();
						}
					}))), e;
				})(), () => (() => {
					let e = m("<p class=rsq-muted>");
					return l(e, () => w("empty")), e;
				})()), d), l(n, o(C, {
					get checked() {
						return T.stopOnError;
					},
					onChange: (e) => F((t) => {
						t.stopOnError = e;
					}),
					get label() {
						return w("stopOnError");
					}
				}), d), i(d, o(r, {
					variant: "primary",
					get disabled() {
						return O() || T.steps.length === 0;
					},
					onClick: () => void K(),
					get children() {
						return [o(S, {
							name: "play",
							size: 14
						}), () => w("run")];
					}
				})), i(d, o(r, {
					get disabled() {
						return !O();
					},
					onClick: q,
					get children() {
						return [o(S, {
							name: "stop",
							size: 14
						}), () => w("stop")];
					}
				})), i(n, (() => {
					let e = t(() => !!O());
					return () => e() ? (() => {
						let e = m("<p class=rsq-progress role=status>");
						return l(e, () => w("stepOf", {
							n: A().at,
							total: A().total,
							name: A().name
						})), e;
					})() : !1;
				})()), i(n, (() => {
					let e = t(() => E() !== "");
					return () => e() ? (() => {
						let e = m("<p class=rsq-err role=alert>");
						return l(e, E), e;
					})() : !1;
				})()), n;
			}
		},
		order: 45
	}), e.ui.slot("topbar", () => a(O, () => (() => {
		let e = m("<span class=rsq-badge role=status>");
		return l(e, () => w("badge", {
			done: A().at,
			total: A().total
		})), e;
	})()));
} });
s(["input"]);
//#endregion
export { S as default };
