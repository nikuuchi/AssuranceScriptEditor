var TimeLine = function($root) {
	var self = this;

	var $timeline = $("<div></div>")
		.addClass("timeline")
		.css("display", "none")
		.appendTo($root);
	var $canvas = $("<canvas></canvas>")
		.css("position", "absolute")
		.appendTo($timeline);
	var $container = $("<div></div>").css({
		position: "absolute", left: 0, top: 0,
	}).appendTo($timeline);

	var $control = $("<div></div>")
		.addClass("timeline-control")
		.html("▼")
		.appendTo($root);

	$("<div></div>")
		.addClass("timeline-title")
		.html("Commit History")
		.appendTo($timeline);

	this.onArgumentSelected = function(argId) {}

	//--------------------------------------------------------

	var scroll = 0;
	var mouseX = null;
	var dragX = 0;

	$timeline.mousedown(function(e) {
		mouseX = e.pageX;
	});

	$timeline.mousemove(function(e) {
		if(mouseX != null) {
			dragX = e.pageX - mouseX;
			self.drag();
		}
	});

	$timeline.mouseup(function(e) {
		scroll += dragX;
		dragX = 0;
		mouseX = null;
		self.drag();
	});

	var visible = true;
	$control.click(function() {
		visible = !visible;
		$timeline.css("display", visible ? "block" : "none");
		$control.html(visible ? "▼" : "▲");
	});

	//--------------------------------------------------------

	var selected = null;
	var MX = 24;
	var MY = 24;
	var NX = 50;
	var NY = 30;

	this.argument = null;

	this.drag = function() {
		$container.css("left", scroll + dragX);
		$canvas.attr("left", scroll + dragX);
		$canvas.css("left", scroll + dragX);
	};

	function addCommitMark(x, y, list, commitId) {
		var $d = $("<div></div>").css({
			left: x, top: y, width: MX, height: MY,
		}).addClass("timeline-commit")
			.appendTo($container)

		var info = list[commitId];
		var time = new Date(info.time * 1000);
		var timefmt = time.getFullYear() + "/" + time.getMonth() + "/" + time.getDay() +
			" " + time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds();

		$d.popover({
			placement: "top",
			title: timefmt + " " + info.userName,
			content: info.commitMessage,
			trigger: "hover",
		});
		
		$d.click(function() {
			console.log("arguemnt " + commitId);
			if(selected != $d) {
				var argId = self.argument.argId;
				if(self.onArgumentSelected(argId, commitId)) {
					if(selected != null) {
						selected.css("border-color", "");
						selected = $d;
					}
					$d.css("border-color", "orange");
				}
			}
		});

		if(commitId == self.argument.commitId) {
			$d.css("border-color", "orange");
			selected = $d;
		}
	}

	function calcSize(mm, x, y, id) {
		var b = { w: x, h: y };
		var c = mm[id];
		if(c != null) {
			var b1 = calcSize(mm, x+NX, y, c[0]);
			b.w = Math.max(b.w, b1.w);
			y = b.h = Math.max(b.h, b1.h);
			for(var i=1; i<c.length; i++) {
				var b2 = calcSize(mm, x+NX, y+NY, c[i]);
				b.w = Math.max(b.w, b2.w);
				y = b.h = Math.max(b.h, b2.h);
			}
		}
		return b;
	}

	function put(ctx, mm, l, x, y, id) {
		addCommitMark(x, y, l, id);
		var c = mm[id];
		if(c != null) {
			var y0 = y;
			y = put(ctx, mm, l, x+NX, y, c[0]);
			ctx.moveTo(x+MX/2   , y0+MY/2);
			ctx.lineTo(x+MX/2+NX, y0+MY/2);
			for(var i=1; i<c.length; i++) {
				var y1 = y;
				y = put(ctx, mm, l, x+NX, y+NY, c[i]);
				ctx.moveTo(x+MX/2   , y0+MY/2);
				ctx.lineTo(x+MX/2   , y1+NY+MY/2);
				ctx.lineTo(x+MX/2+NX, y1+NY+MY/2);
			}
		}
		return y;
	}

	this.repaint = function(arg) {
		self.argument = arg;
		$container.empty();

		$timeline.css("display", arg != null ? "block" : "none");
		if(arg == null) {
			return;
		}

		var mm = {};
		var l = DCaseAPI.getCommitList(arg.getArgumentId());
		for(var i=0; i<l.length-1; i++) {
			var x = mm[l[i].commitId];
			if(x == null) x = [];
			if(x.indexOf(l[i+1].commitId) == -1) x.push(l[i + 1].commitId);
			mm[l[i].commitId] = x;
		}

		var ci = {};
		for(var i=0; i<l.length; i++) {
			ci[l[i].commitId] = l[i];
		}
		//$.each(DCaseAPI.getBranchList(arg.argId), function(i, br) {
		//	if(br != arg.commitId) {
		//		var l = DCaseAPI.call("getCommitList", { commitId: br }).commitIdList;
		//		for(var i=0; i<l.length-1; i++) {
		//			var x = mm[l[i]];
		//			if(x == null) x = [];
		//			if(x.indexOf(l[i+1]) == -1) x.push(l[i + 1]);
		//			mm[l[i]] = x;
		//		}
		//	}
		//});
		selected = null;

		var b = calcSize(mm, 0, 0, l[0].commitId);
		b.w += MX * 2;
		b.h += MY * 2;
		$timeline.height(b.h);
		b.h -= MX / 2;
		$canvas.css("width" , b.w);
		$canvas.attr("width", b.w);
		$canvas.css("height" , b.h);
		$canvas.attr("height", b.h);

		$container.css("top", MX/2);
		$canvas.attr("top", MX/2);
		$canvas.css("top", MX/2);

		var ctx = $canvas[0].getContext("2d");
		ctx.clearRect(0, 0, $canvas.width(), $canvas.height());
		ctx.beginPath();
		var y = put(ctx, mm, ci, 0, 0, l[0].commitId);
		ctx.stroke();

		scroll = ($timeline.width() - b.w) / 2;
		self.drag();
	};
};

