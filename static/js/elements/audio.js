/*
   This file is part of iros
   Copyright (C) 2024 Alex <uni@vrsal.xyz>

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as published
   by the Free Software Foundation, version 3 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.

   You should have received a copy of the GNU Affero General Public License
   along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

function start_media() {
    if (edt.selected_element) {
        edt.selected_element.media_html.play();
    }
}

function pause_media() {
    if (edt.selected_element) {
        edt.selected_element.media_html.pause();
    }
}

var last_media_update = 0;
class audio_element extends element {
    constructor(parent, data, type = "audio") {
        super(parent, type, data);
        this.html = $(`<div class="iros-element"  id="${this.data.id}"></div>`);
        this.media_html = $(`<${type} controls class="iros-element iros-media-element" id="${this.data.id}" src="${this.data.url}"></${type}>`);
        this.html.append(this.media_html);
        this.is_remote_event = false;
        this.native_controls = this.data.native_controls;

        if (parent.is_editor()) {
            this.media_html.muted = true; // we don't want to hear the audio in the editor
            // react to pausing, volume change, seeking, etc.
            $(this.media_html).on("pause", () => {

                if (!this.is_remote_event) {
                    this.data.paused = true;
                    send_command_update_element(this.parent, this);
                }
            });

            $(this.media_html).on("play", () => {

                if (!this.is_remote_event) {
                    this.data.paused = false;
                    send_command_update_element(this.parent, this);
                }
            });

            $(this.media_html).on("volumechange", () => {
                if (!this.is_remote_event) {
                    this.data.volume = this.media_html.volume;
                    send_command_update_element(this.parent, this);
                }
            });

            $(this.media_html).on("ratechange", () => {
                if (!this.is_remote_event) {
                    this.data.playback_rate = this.media_html.playbackRate;
                    send_command_update_element(this.parent, this);
                }
            });

            $(this.media_html).on("seeking", (event) => {
                if (!this.is_remote_event) {
                    this.data.current_time = this.media_html.currentTime;
                    send_command_update_element(this.parent, this);
                }
            });

            $(this.media_html).on("click", event => {
                // if the user clicks on the video and it is not the current element, prevent the click
                if (this.parent.selected_element != this) {
                    event.preventDefault();
                }
            });
        }
    }

    set_url(url) {
        if (url == this.data.url)
            return;

        // validate url by turning it into a URL object
        try {
            let _tmp = new URL(url);
        } catch (e) {
            console.log("Invalid URL: ", url);
            return;
        }

        this.media_html.src = url;
        this.data.url = url;
    }

    tick() {
        if (!this.media_html.paused) {
            this.data.current_time = this.media_html.currentTime;
            let time = Date.now();
            if (this.parent.is_editor() && edt.selected_element == this && time - last_media_update > 500) {
                last_media_update = time;
                $('#seek-bar').value = this.media_html.currentTime / this.media_html.duration * 100;
                $('#progress').innerText = seconds_to_time(this.media_html.currentTime, false);
                $('#runtime').innerText = seconds_to_time(this.media_html.duration, false);
            }
        }
    }

    tickable() { return true; }

    update() {
        this.is_remote_event = true; // prevent sending an update in response to this event
        super.update();
        this.set_native_controls(this.data.native_controls);

        this.media_html.style.width = `${this.data.transform.width}px`;
        this.media_html.style.height = `${this.data.transform.height}px`;

        // update volume, playback rate, etc.
        if (Math.abs(this.media_html.volume - this.data.volume) > 0.01)
            this.media_html.volume = this.data.volume;
        if (Math.abs(this.media_html.playbackRate - this.data.playback_rate) > 0.01)
            this.media_html.playbackRate = this.data.playback_rate;
        if (this.media_html.loop != this.data.loop)
            this.media_html.loop = this.data.loop;
        if (Math.abs(this.media_html.currentTime - this.data.current_time) > 1)
            this.media_html.currentTime = this.data.current_time;

        if (this.media_html.src.indexOf(this.data.url) == -1) {
            this.media_html.src = this.data.url;
            this.data.current_time = 0;
        }

        if (this.data.paused != this.media_html.paused) {
            if (this.data.paused)
                this.media_html.pause();
            else
                this.media_html.play();
        }
        this.is_remote_event = false;
    }

    set_native_controls(native_controls) {
        this.data.native_controls = native_controls;
        this.media_html.controls = this.data.native_controls;
        return true;
    }

    set_playback_rate(playback_rate) {
        this.data.playback_rate = playback_rate;
        this.media_html.playbackRate = this.data.playback_rate;
        return true;
    }

    is_resizable() { return true; }
}

class audio_element_handler extends element_handler {
    constructor(edt, type = "audio") {
        super(edt, type);
        this.url_settings = $("#url-settings");
        this.media_settings = $("#media-settings");
        this.playback_rate = $("#speed-input");
        this.url = $("#url-input");
        this.seek_bar = $("#seek-bar");
        this.volume = $("#volume-input");
        this.native_controls = $("#native-controls");
        this.selected_element = null;
        this.url.on("input", () => this.update_selected_element());
        this.volume.on("input", () => this.update_selected_element());
        this.playback_rate.on("input", () => this.update_selected_element());
        this.native_controls.on("change", () => this.update_selected_element());
        this.seek_bar.on("input", () => {
            if (this.selected_element) {
                this.selected_element.media_html.currentTime = this.selected_element.media_html.duration * this.seek_bar.value / 100;
                send_command_update_element(this.edt, this.selected_element);
            }
        });
    }

    update_selected_element() {
        if (this.selected_element) {
            check_dc(this.url.value);
            this.selected_element.set_url(this.url.value);
            this.selected_element.data.volume = this.volume.value / 100.0;
            this.selected_element.set_playback_rate(this.playback_rate.value / 100.0);
            this.selected_element.set_native_controls(this.native_controls.checked);
            send_command_update_element(this.edt, this.selected_element);
        }
    }

    show_settings(element) {
        this.url_settings.style.display = "grid";
        this.media_settings.style.display = "grid";

        this.url.value = element.data.url;
        this.volume.value = element.data.volume * 100.0;
        this.selected_element = element;
        this.native_controls.checked = element.data.native_controls;
    }

    hide_settings() {
        this.url_settings.style.display = "none";
        this.media_settings.style.display = "none";
        this.selected_element = null;
    }
}

function add_audio_element(url = null, name = null, width = 300, height = 50) {
    if (url === null)
        url = "";
    if (name === null)
        name = `Audio ${edt.get_next_element_id()}`;
    let data = {
        url,
        transform: {
            x: 0,
            y: 0,
            width,
            height,
        },
        name,
        loop: false,
        volume: 0.5,
        playback_rate: 1,
        paused: true,
        current_time: 0,
        native_controls: false,
    };
    edt.add_element(create_element(edt, "audio", data));
}