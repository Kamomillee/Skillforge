/**
 * Code Python du correcteur, chargé une fois dans l'interpréteur Pyodide (navigateur ou tests Node).
 * Principe : on teste le COMPORTEMENT observé (valeurs retournées, absence de mutation),
 * jamais l'identité du code. Chaque exécution utilise un espace de noms neuf.
 */
export const HARNESS_PY = String.raw`
import sys, io, json, math, copy, traceback

_SF_FILE = "<exercice>"
_SF_MAX_OUT = 20000


class _SfCapture(io.StringIO):
    truncated = False

    def write(self, s):
        if self.tell() > _SF_MAX_OUT:
            self.truncated = True
            return len(s)
        return super().write(s)


def _sf_error_info(exc):
    info = {"type": type(exc).__name__, "message": str(exc), "line": None, "text": None, "frames": []}
    if isinstance(exc, SyntaxError) and exc.filename == _SF_FILE:
        info["message"] = exc.msg
        info["line"] = exc.lineno
        info["offset"] = exc.offset
        info["text"] = (exc.text or "").rstrip("\n")
    else:
        frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename == _SF_FILE]
        info["frames"] = [{"line": f.lineno, "name": f.name, "text": f.line} for f in frames]
        if frames:
            info["line"] = frames[-1].lineno
            info["text"] = frames[-1].line
    info["summary"] = "".join(traceback.format_exception_only(type(exc), exc)).strip()
    return info


def _sf_repr(v, limit=300):
    try:
        r = repr(v)
    except Exception as e:  # repr défaillant d'un objet de l'étudiant
        r = "<repr impossible : %s>" % type(e).__name__
    return r if len(r) <= limit else r[:limit] + "…"


def _sf_equal(got, expected, mode, tol):
    if isinstance(got, bool) != isinstance(expected, bool):
        return False
    if mode == "approx":
        if not isinstance(got, (int, float)):
            return False
        return math.isclose(got, expected, rel_tol=0.0, abs_tol=tol)
    if isinstance(expected, list) and isinstance(got, tuple):
        got = list(got)
    return got == expected


def _sf_exec(code):
    ns = {"__name__": "__main__"}
    out = _SfCapture()
    old = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    err = None
    try:
        exec(compile(code, _SF_FILE, "exec"), ns)
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        err = _sf_error_info(e)
    finally:
        sys.stdout, sys.stderr = old
    return ns, out, err


def sf_run(code):
    """Exécution libre : la sortie part directement vers sys.stdout (diffusée par le worker)."""
    ns = {"__name__": "__main__"}
    try:
        exec(compile(code, _SF_FILE, "exec"), ns)
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        return json.dumps({"error": _sf_error_info(e)})
    return json.dumps({"error": None})


def sf_grade(code, spec_json):
    spec = json.loads(spec_json)
    res = {"stdout": "", "loadError": None, "missingFunction": False, "placeholder": "___" in code, "tests": []}
    ns, out, err = _sf_exec(code)
    res["stdout"] = out.getvalue()
    res["stdoutTruncated"] = out.truncated
    if err:
        res["loadError"] = err
        return json.dumps(res)
    fn = ns.get(spec["functionName"])
    if not callable(fn):
        res["missingFunction"] = True
        return json.dumps(res)
    for t in spec["tests"]:
        args = copy.deepcopy(t["args"])
        snapshot = copy.deepcopy(t["args"])
        cap = _SfCapture()
        old = sys.stdout
        sys.stdout = cap
        r = {"id": t["id"], "passed": False}
        try:
            got = fn(*args)
            r["got"] = _sf_repr(got)
            ok = _sf_equal(got, t["expected"], t.get("compare", "exact"), t.get("tolerance") or 1e-9)
            if got is None and t["expected"] is not None:
                r["returnedNone"] = True
            if ok and t.get("checkNoMutation") and args != snapshot:
                ok = False
                r["mutated"] = True
            r["passed"] = bool(ok)
        except KeyboardInterrupt:
            raise
        except BaseException as e:
            r["error"] = _sf_error_info(e)
        finally:
            sys.stdout = old
        r["stdout"] = cap.getvalue()[:2000]
        res["tests"].append(r)
    return json.dumps(res)


def sf_trace(code, watch_json, max_steps=500):
    """Trace réelle (sys.settrace) : ligne sur le point d'être exécutée + variables surveillées."""
    watch = json.loads(watch_json)
    steps = []

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != _SF_FILE:
            return None
        if event == "line" and len(steps) < max_steps:
            env = frame.f_locals
            steps.append({"line": frame.f_lineno, "vars": {k: repr(env[k]) for k in watch if k in env}})
        return tracer

    ns = {"__name__": "__main__"}
    out = _SfCapture()
    old = sys.stdout
    sys.stdout = out
    sys.settrace(tracer)
    try:
        exec(compile(code, _SF_FILE, "exec"), ns)
    finally:
        sys.settrace(None)
        sys.stdout = old
    return json.dumps({"steps": steps, "stdout": out.getvalue()})
`;
